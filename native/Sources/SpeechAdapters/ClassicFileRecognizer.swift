import Foundation
import HelperKit
import SpeechCore

/// SFSpeechRecognizer with server fallback disabled and a one-minute limit.
struct ClassicFileRecognizer: FileRecognizing {
    /// The locale every file is transcribed in.
    let locale: String

    func transcribe(fileAt url: URL) async throws -> String {
        let job = try await ClassicFileJob(locale: locale)
        return try await withTimeout(SpeechTimeouts.fileRecognition, failure: SpeechFailure.timedOut) {
            try await job.recognize(audioURL: url)
        }
    }
}
