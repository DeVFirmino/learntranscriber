/// What one callback of a live recognition task reports.
public enum StreamingTaskOutcome: Equatable, Sendable {
    /// Recognized text; `isFinal` when the task will report nothing more.
    case transcript(String, isFinal: Bool)
    /// The task ended because the utterance held no recognizable speech. This is the normal end of a silent
    /// utterance, not a failure of the session.
    case noSpeech
    /// The task failed; the message is the recognizer's description of the failure.
    case failure(String)

    /// Whether the task reports nothing after this outcome.
    public var endsTask: Bool {
        switch self {
        case .transcript(_, let isFinal): isFinal
        case .noSpeech, .failure: true
        }
    }
}
