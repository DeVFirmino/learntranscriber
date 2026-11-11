import Foundation

/// What a running capture delivers, in the order it happened.
public enum CaptureEvent: Equatable, Sendable {
    /// Captured audio as 16 kHz mono PCM16 (`HelperAudioFormat`).
    case audio(Data)
    /// The capture is being rebuilt; audio resumes after the matching `deviceChanged`.
    case reconnecting(reason: String)
    /// The capture now follows the output `id`, shown to the person as `name`.
    case deviceChanged(id: String, name: String)
}
