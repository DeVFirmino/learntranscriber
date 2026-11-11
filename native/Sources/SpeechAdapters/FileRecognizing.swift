import Foundation

/// Transcribes audio files on this device in the locale it was made for.
public protocol FileRecognizing: Sendable {
    /// Everything recognized in the audio file at `url`.
    func transcribe(fileAt url: URL) async throws -> String
}
