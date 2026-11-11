@testable import SystemAudioCore

/// Collects the protocol lines a session writes.
@MainActor
final class LineRecorder {
    private(set) var lines: [AudioPacket] = []

    func write(_ packet: AudioPacket) { lines.append(packet) }
}
