import CoreAudio
import Foundation
import HelperKit
import SystemAudioCore

/// Read-only Core Audio queries: devices, their names and channels, the default output and running processes.
/// Nothing here opens a stream or changes the system's output.
public enum CoreAudioDevices {
    /// Returns every device with a UID and the default output, as the `devices` protocol line.
    public static func list() throws -> OutputDeviceList {
        let infos = try objectIDs(listedBy: kAudioHardwarePropertyDevices).compactMap { id -> AudioDeviceInfo? in
            guard let uid = stringProperty(kAudioDevicePropertyDeviceUID, of: id) else { return nil }
            return AudioDeviceInfo(
                uid: uid,
                name: stringProperty(kAudioObjectPropertyName, of: id) ?? "",
                outputChannels: channelCount(of: id, in: kAudioObjectPropertyScopeOutput),
                inputChannels: channelCount(of: id, in: kAudioObjectPropertyScopeInput))
        }
        return OutputDeviceList(devices: infos, defaultOutputUID: defaultOutputUID())
    }

    /// The device the system currently plays sound on, or `nil` when there is none.
    public static func defaultOutputID() -> AudioObjectID? {
        var address = propertyAddress(kAudioHardwarePropertyDefaultOutputDevice)
        var id = AudioObjectID(kAudioObjectUnknown)
        var size = UInt32(MemoryLayout<AudioObjectID>.size)
        let status = AudioObjectGetPropertyData(AudioObjectID(kAudioObjectSystemObject), &address, 0, nil, &size, &id)
        return status == noErr && id != kAudioObjectUnknown ? id : nil
    }

    /// The UID of the default output, or `nil` when there is none.
    public static func defaultOutputUID() -> String? {
        defaultOutputID().flatMap { stringProperty(kAudioDevicePropertyDeviceUID, of: $0) }
    }

    /// The name the system shows for the device `id`.
    public static func name(of id: AudioObjectID) -> String? { stringProperty(kAudioObjectPropertyName, of: id) }

    /// Process objects whose bundle identifier starts with `bundleID`, so a tap can leave the app's own sound out.
    ///
    /// The match is by prefix so the app's helper processes, whose identifiers extend the app's, are left out too.
    public static func processes(withBundleID bundleID: String) -> [AudioObjectID] {
        guard bundleID.isEmpty == false, let all = try? objectIDs(listedBy: kAudioHardwarePropertyProcessObjectList) else { return [] }
        return all.filter { stringProperty(kAudioProcessPropertyBundleID, of: $0)?.hasPrefix(bundleID) == true }
    }

    /// The address of `selector` on the main element of `scope`.
    static func propertyAddress(_ selector: AudioObjectPropertySelector, scope: AudioObjectPropertyScope = kAudioObjectPropertyScopeGlobal)
        -> AudioObjectPropertyAddress
    {
        AudioObjectPropertyAddress(mSelector: selector, mScope: scope, mElement: kAudioObjectPropertyElementMain)
    }

    /// The object IDs the system object lists under `selector`; empty when it lists none.
    static func objectIDs(listedBy selector: AudioObjectPropertySelector) throws -> [AudioObjectID] {
        var address = propertyAddress(selector)
        var size: UInt32 = 0
        let system = AudioObjectID(kAudioObjectSystemObject)
        var status = AudioObjectGetPropertyDataSize(system, &address, 0, nil, &size)
        guard status == noErr else { throw HelperError("Core Audio could not list audio objects (\(status)).") }
        guard size > 0 else { return [] }
        var ids = [AudioObjectID](repeating: 0, count: Int(size) / MemoryLayout<AudioObjectID>.size)
        status = ids.withUnsafeMutableBytes { buffer in
            guard let base = buffer.baseAddress else { return kAudioHardwareBadPropertySizeError }
            return AudioObjectGetPropertyData(system, &address, 0, nil, &size, base)
        }
        guard status == noErr else { throw HelperError("Core Audio could not read audio objects (\(status)).") }
        return Array(ids.prefix(Int(size) / MemoryLayout<AudioObjectID>.size))
    }

    /// The string `selector` holds on the object `id`, or `nil` when it has none.
    static func stringProperty(_ selector: AudioObjectPropertySelector, of id: AudioObjectID) -> String? {
        var address = propertyAddress(selector)
        var value: Unmanaged<CFString>?
        var size = UInt32(MemoryLayout<Unmanaged<CFString>?>.size)
        let status = withUnsafeMutablePointer(to: &value) { AudioObjectGetPropertyData(id, &address, 0, nil, &size, $0) }
        guard status == noErr, let value else { return nil }
        return value.takeRetainedValue() as String
    }

    /// The channels of the device `id` in `scope`, summed over its streams; zero when it has none there.
    static func channelCount(of id: AudioObjectID, in scope: AudioObjectPropertyScope) -> Int {
        var address = propertyAddress(kAudioDevicePropertyStreamConfiguration, scope: scope)
        var size: UInt32 = 0
        guard AudioObjectGetPropertyDataSize(id, &address, 0, nil, &size) == noErr, size > 0 else { return 0 }
        let raw = UnsafeMutableRawPointer.allocate(byteCount: Int(size), alignment: MemoryLayout<AudioBufferList>.alignment)
        defer { raw.deallocate() }
        guard AudioObjectGetPropertyData(id, &address, 0, nil, &size, raw) == noErr else { return 0 }
        let buffers = UnsafeMutableAudioBufferListPointer(raw.assumingMemoryBound(to: AudioBufferList.self))
        return buffers.reduce(0) { $0 + Int($1.mNumberChannels) }
    }
}
