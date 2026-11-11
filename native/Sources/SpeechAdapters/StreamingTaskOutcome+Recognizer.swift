import Foundation
import SpeechCore

extension StreamingTaskOutcome {
    /// The error Apple Speech reports for an utterance with no recognized speech. Apple documents it as the end
    /// of that utterance, not as a stopped audio session, so it is `.noSpeech` rather than `.failure`.
    static let noSpeechDomain = "kAFAssistantErrorDomain"
    /// The code of the no-speech error in `noSpeechDomain`.
    static let noSpeechCode = 1110

    /// Classifies one callback of an `SFSpeechRecognitionTask`: an error wins over any text it came with.
    init(text: String?, isFinal: Bool, error: (any Error)?) {
        if let error {
            let failure = error as NSError
            self = failure.domain == Self.noSpeechDomain && failure.code == Self.noSpeechCode
                ? .noSpeech : .failure(error.localizedDescription)
        } else {
            self = .transcript(text ?? "", isFinal: isFinal)
        }
    }
}
