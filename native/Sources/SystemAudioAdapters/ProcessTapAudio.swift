import CoreAudio
import Foundation
import HelperKit
import SystemAudioCore

/// Captures what plays on the default output with a Core Audio process tap (macOS 14.2 or later), as this app's
/// native output source. The tap is private and unmuted, so the output itself is left as it was; the app's own
/// processes are excluded. A private aggregate device clocked by the default output delivers the tapped audio.
/// When the default output changes, the aggregate moves to the new output and the same stream carries on;
/// `reconnecting` and then `deviceChanged` events surround the move.
@available(macOS 14.2, *)
@MainActor
public final class ProcessTapAudio: AudioCapturing {
    /// The name the tap and its aggregate device carry in Audio MIDI Setup and in diagnostics.
    private static let deviceName = "LearnTranscriber incoming audio"
    /// The `reconnecting` reason reported for a default output change.
    private static let outputChangeReason = "default output changed"

    /// Core Audio calls the IOProc on this queue; it must not be the main one, which the listener uses.
    private let ioQueue = DispatchQueue(label: "dev.learntranscriber.tap")
    private var tapID = AudioObjectID(kAudioObjectUnknown)
    private var aggregateID = AudioObjectID(kAudioObjectUnknown)
    private var procID: AudioDeviceIOProcID?
    private var sink: TapSink?
    private var follower: DefaultOutputFollower?
    private var listener: AudioObjectPropertyListenerBlock?

    /// Creates an idle capture.
    public init() {}

    public func start(_ options: CaptureOptions) async throws -> AsyncThrowingStream<CaptureEvent, any Error> {
        let description = CATapDescription(stereoGlobalTapButExcludeProcesses: CoreAudioDevices.processes(withBundleID: options.excludedBundleID))
        description.name = Self.deviceName
        description.isPrivate = true
        description.muteBehavior = CATapMuteBehavior.unmuted
        let tapUID = description.uuid.uuidString
        let (events, continuation) = AsyncThrowingStream<CaptureEvent, any Error>.makeStream()
        do {
            // Listening starts before the default output is read, so a change in between is not missed: the
            // listener runs on the main queue, after this method, and compares against what was read here.
            followDefaultOutput(tapUID: tapUID)
            guard let outputUID = CoreAudioDevices.defaultOutputUID() else {
                throw HelperError("No output device is available to capture.")
            }
            follower = DefaultOutputFollower(current: outputUID)
            let status = AudioHardwareCreateProcessTap(description, &tapID)
            guard status == noErr else { throw Self.failure("The system audio tap could not be created", status) }
            let sink = TapSink(continuation: continuation)
            self.sink = sink
            try open(outputUID, tapUID: tapUID, into: sink)
        } catch {
            await stop()
            continuation.finish()
            throw error
        }
        return events
    }

    public func stop() async {
        stopFollowingDefaultOutput()
        close()
        if tapID != kAudioObjectUnknown { AudioHardwareDestroyProcessTap(tapID) }
        tapID = AudioObjectID(kAudioObjectUnknown)
        sink?.continuation.finish()
        sink = nil
    }

    /// Builds the private aggregate on `outputUID` with the tap `tapUID` and starts delivering its audio to `sink`,
    /// which follows the tap's current rate.
    private func open(_ outputUID: String, tapUID: String, into sink: TapSink) throws {
        let aggregate: [String: Any] = [
            kAudioAggregateDeviceNameKey: Self.deviceName,
            kAudioAggregateDeviceUIDKey: "dev.danieldias.learntranscriber.tap.\(UUID().uuidString)",
            kAudioAggregateDeviceMainSubDeviceKey: outputUID,
            kAudioAggregateDeviceIsPrivateKey: true,
            kAudioAggregateDeviceIsStackedKey: false,
            kAudioAggregateDeviceTapAutoStartKey: true,
            kAudioAggregateDeviceSubDeviceListKey: [[kAudioSubDeviceUIDKey: outputUID]],
            kAudioAggregateDeviceTapListKey: [
                [kAudioSubTapDriftCompensationKey: true, kAudioSubTapUIDKey: tapUID]
            ],
        ]
        var status = AudioHardwareCreateAggregateDevice(aggregate as CFDictionary, &aggregateID)
        guard status == noErr else { throw Self.failure("The system audio tap device could not be created", status) }
        sink.follow(sampleRate: try tapSampleRate())
        status = AudioDeviceCreateIOProcIDWithBlock(&procID, aggregateID, ioQueue, sink.makeIOBlock())
        guard status == noErr, let procID else { throw Self.failure("The system audio tap could not deliver audio", status) }
        status = AudioDeviceStart(aggregateID, procID)
        guard status == noErr else { throw Self.failure("The system audio tap could not start", status) }
    }

    /// Stops and removes the aggregate; the tap and the stream stay.
    private func close() {
        if let procID, aggregateID != kAudioObjectUnknown {
            AudioDeviceStop(aggregateID, procID)
            AudioDeviceDestroyIOProcID(aggregateID, procID)
        }
        procID = nil
        if aggregateID != kAudioObjectUnknown { AudioHardwareDestroyAggregateDevice(aggregateID) }
        aggregateID = AudioObjectID(kAudioObjectUnknown)
    }

    /// Listens for default output changes on the main queue.
    private func followDefaultOutput(tapUID: String) {
        let block: AudioObjectPropertyListenerBlock = { [weak self] _, _ in
            // Registered on the main queue below, so this always runs on the main actor.
            MainActor.assumeIsolated { self?.defaultOutputChanged(tapUID: tapUID) }
        }
        var address = CoreAudioDevices.propertyAddress(kAudioHardwarePropertyDefaultOutputDevice)
        if AudioObjectAddPropertyListenerBlock(AudioObjectID(kAudioObjectSystemObject), &address, DispatchQueue.main, block) == noErr {
            listener = block
        }
    }

    /// Removes the listener and forgets the followed output; safe when not listening.
    private func stopFollowingDefaultOutput() {
        if let listener {
            var address = CoreAudioDevices.propertyAddress(kAudioHardwarePropertyDefaultOutputDevice)
            AudioObjectRemovePropertyListenerBlock(AudioObjectID(kAudioObjectSystemObject), &address, DispatchQueue.main, listener)
        }
        listener = nil
        follower = nil
    }

    /// Moves the aggregate to the new default output. A failed move stops following and ends the stream with the
    /// error, so a later change cannot build another aggregate.
    private func defaultOutputChanged(tapUID: String) {
        guard let sink, let uid = follower?.follow(CoreAudioDevices.defaultOutputUID()) else { return }
        sink.continuation.yield(.reconnecting(reason: Self.outputChangeReason))
        close()
        do {
            try open(uid, tapUID: tapUID, into: sink)
        } catch {
            close()
            stopFollowingDefaultOutput()
            sink.continuation.finish(throwing: error)
            return
        }
        let name = CoreAudioDevices.defaultOutputID().flatMap { CoreAudioDevices.name(of: $0) } ?? uid
        sink.continuation.yield(.deviceChanged(id: uid, name: name))
    }

    /// The tap's sample rate; throws unless it delivers Float32.
    private func tapSampleRate() throws -> Double {
        var address = CoreAudioDevices.propertyAddress(kAudioTapPropertyFormat)
        var description = AudioStreamBasicDescription()
        var size = UInt32(MemoryLayout<AudioStreamBasicDescription>.size)
        let status = AudioObjectGetPropertyData(tapID, &address, 0, nil, &size, &description)
        let format = StreamFormat(description)
        guard status == noErr, format.sampleRate > 0 else { throw Self.failure("The system audio tap format is unavailable", status) }
        guard format.isFloat32 else { throw HelperError("The system audio tap uses an unsupported sample format.") }
        return format.sampleRate
    }

    /// The person-facing failure for a Core Audio status, naming the permission the tap needs.
    private static func failure(_ message: String, _ status: OSStatus) -> HelperError {
        HelperError(
            "\(message) (\(status)). Allow System Audio Recording Only for LearnTranscriber in Privacy & Security, then retry.")
    }
}
