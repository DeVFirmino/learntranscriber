import Foundation
import Speech
import SpeechCore

/// Owns one callback-based file recognition task on the main actor.
@MainActor
final class ClassicFileJob {
    private let recognizer: SFSpeechRecognizer
    private var task: SFSpeechRecognitionTask?
    private var continuation: CheckedContinuation<String, any Error>?

    /// Prepares an on-device recognizer for `locale`, or throws the matching `SpeechFailure`.
    init(locale: String) throws { recognizer = try SFSpeechRecognizer.onDevice(locale: locale) }

    /// The final transcript of the file at `audioURL`. Cancelling the calling task ends the native task.
    func recognize(audioURL: URL) async throws -> String {
        try Task.checkCancellation()
        return try await withTaskCancellationHandler {
            try await withCheckedThrowingContinuation { continuation in
                self.continuation = continuation
                let request = SFSpeechURLRecognitionRequest(url: audioURL)
                request.requiresOnDeviceRecognition = true
                request.shouldReportPartialResults = false
                request.taskHint = .dictation
                task = recognizer.recognitionTask(with: request) { [weak self] result, error in
                    let text = result?.bestTranscription.formattedString
                    let isFinal = result?.isFinal ?? false
                    let message = error?.localizedDescription
                    Task { @MainActor [weak self] in
                        if isFinal, let text { self?.finish(with: .success(text)) }
                        else if let message { self?.finish(with: .failure(SpeechFailure.recognitionFailed(message))) }
                    }
                }
            }
        } onCancel: {
            Task { @MainActor [weak self] in self?.finish(with: .failure(CancellationError())) }
        }
    }

    /// Resolves the continuation at most once and tears down the native task.
    private func finish(with result: Result<String, any Error>) {
        guard let continuation else { return }
        self.continuation = nil
        task?.cancel()
        task = nil
        continuation.resume(with: result)
    }
}
