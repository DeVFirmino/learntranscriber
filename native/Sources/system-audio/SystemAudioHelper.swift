import ArgumentParser
import CommandKit
import Foundation
import HelperKit
import SystemAudioAdapters
import SystemAudioCore

/// Captures system audio for the desktop app. Only an explicit capture request asks for a recording permission;
/// `--status`, `--list-devices` and `--self-test` never capture anything.
@main
struct SystemAudioHelper: AsyncParsableCommand {
    static let configuration = CommandConfiguration(commandName: "system-audio", abstract: "Stream system audio as PCM16 packets.")

    @Flag(help: "Report whether capture is supported and permitted.")
    var status = false

    @Flag(help: "Emit one second of a synthetic tone instead of capturing.")
    var selfTest = false

    @Flag(help: "Write smaller packets for live captions.")
    var livePackets = false

    @Flag(help: "List output devices and the default output without capturing.")
    var listDevices = false

    @Flag(help: "Capture the default output with a Core Audio process tap (macOS 14.2 or later) instead of ScreenCaptureKit.")
    var processTap = false

    @Option(help: "Display ID to capture; the first connected display when omitted or not a number.")
    var display: String?

    @Option(help: "Bundle identifier whose audio is excluded.")
    var excludeBundle = "dev.danieldias.learntranscriber"

    static let usage = "Choose --status, --list-devices, --self-test, or capture flags (--process-tap, --display, --exclude-bundle, --live-packets)."

    /// Every outcome, including a usage mistake, is one JSON line; failures exit with 1.
    static func main() async {
        do {
            var command = try Self.parse(Array(CommandLine.arguments.dropFirst()).keepingFirstOccurrence(of: ["--display", "--exclude-bundle"]))
            try await command.run()
        } catch {
            Self.exit(reporting: error, usage: usage) { AudioPacket.failure($0) }
        }
    }

    @MainActor
    mutating func run() async throws {
        if status {
            let processTapSupported = if #available(macOS 14.2, *) { true } else { false }
            LineWriter.write(AudioPacket.status(
                supported: true, permissionGranted: ScreenCaptureAudio.isAccessGranted, processTapSupported: processTapSupported))
            return
        }
        if listDevices {
            LineWriter.write(try CoreAudioDevices.list())
            return
        }
        if selfTest {
            LineWriter.write(AudioPacket.started)
            LineWriter.write(AudioPacket.audio(SelfTestTone.oneSecond()))
            LineWriter.write(AudioPacket.stopped)
            return
        }
        let options = CaptureOptions(displayID: display.flatMap(UInt32.init), excludedBundleID: excludeBundle, livePackets: livePackets)
        if processTap {
            guard #available(macOS 14.2, *) else { throw HelperError("The process tap source requires macOS 14.2 or later.") }
            try await Self.capture(options, with: ProcessTapAudio())
        } else {
            try await Self.capture(options, with: ScreenCaptureAudio())
        }
    }

    /// Streams packets until the app writes `stop` or closes stdin, or the capture ends; a failed start throws the
    /// adapter's error, which `main()` reports.
    @MainActor
    static func capture(_ options: CaptureOptions, with capture: some AudioCapturing) async throws {
        let session = CaptureSession(capture: capture, options: options) { LineWriter.write($0) }
        try await session.run(until: StopRequests())
    }
}
