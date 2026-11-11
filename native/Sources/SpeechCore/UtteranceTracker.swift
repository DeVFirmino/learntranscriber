/// Turns recognizer outcomes into protocol events, repeating no partial and emitting at most one final per
/// utterance, so no final text is lost and none is committed twice.
public struct UtteranceTracker: Equatable, Sendable {
    /// What one outcome makes the session emit.
    public enum Emission: Equatable, Sendable {
        /// Provisional text of the current utterance.
        case partial(String)
        /// The settled text of the utterance.
        case final(String)
    }

    /// The last partial emitted and not yet settled; empty when there is none.
    public private(set) var lastPartial = ""

    /// Creates a tracker for a new task.
    public init() {}

    /// Decides what to emit for one outcome of the task.
    ///
    /// - A partial is emitted unless it is blank or repeats the previous one.
    /// - A final settles the utterance with its text; a blank final settles it with the last partial instead.
    /// - "No speech" settles the utterance as an empty final: the recognizer retracted any partial it had shown.
    /// - A failure settles the last partial as final, so the words heard before it are kept.
    public mutating func receive(_ outcome: StreamingTaskOutcome) -> Emission? {
        switch outcome {
        case .transcript(let text, isFinal: false):
            guard isBlank(text) == false, text != lastPartial else { return nil }
            lastPartial = text
            return .partial(text)
        case .transcript(let text, isFinal: true):
            if isBlank(text) { return finish().map(Emission.final) }
            lastPartial = ""
            return .final(text)
        case .noSpeech:
            lastPartial = ""
            return .final("")
        case .failure:
            return finish().map(Emission.final)
        }
    }

    /// Ends the utterance when its task stops without a final result: the last partial becomes the final text.
    public mutating func finish() -> String? {
        defer { lastPartial = "" }
        return lastPartial.isEmpty ? nil : lastPartial
    }

    private func isBlank(_ text: String) -> Bool {
        text.allSatisfy(\.isWhitespace)
    }
}
