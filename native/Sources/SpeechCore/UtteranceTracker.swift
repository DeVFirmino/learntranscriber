import Foundation

/// Turns recognizer outcomes into protocol events, repeating no partial and emitting at most one final per
/// utterance, so no final text is lost and none is committed twice.
///
/// On-device Apple Speech can restart its transcription after a pause inside one task: the next partial holds only
/// the new words, and the final only what followed the last pause. The tracker keeps the words each restart dropped
/// and puts them in front of later partials and the final.
public struct UtteranceTracker: Equatable, Sendable {
    /// What one outcome makes the session emit.
    public enum Emission: Equatable, Sendable {
        /// Provisional text of the current utterance.
        case partial(String)
        /// The settled text of the utterance.
        case final(String)
    }

    /// The last partial emitted and not yet settled, including words kept from earlier restarts; empty when none.
    public private(set) var lastPartial = ""
    /// Words of this utterance that the recognizer dropped when it restarted.
    private var kept = ""
    /// The recognizer's own latest text since its last restart.
    private var segment = ""

    /// Creates a tracker for a new task.
    public init() {}

    /// Decides what to emit for one outcome of the task.
    ///
    /// - A partial is emitted unless it is blank or repeats the previous one.
    /// - A final settles the utterance with its text; a blank final settles it with the last partial instead.
    /// - "No speech" settles the utterance with only the words kept from restarts: the recognizer retracted the
    ///   partial it had shown.
    /// - A failure settles the last partial as final, so the words heard before it are kept.
    public mutating func receive(_ outcome: StreamingTaskOutcome) -> Emission? {
        switch outcome {
        case .transcript(let text, isFinal: false):
            guard isBlank(text) == false else { return nil }
            keepDroppedWords(before: text)
            segment = text
            let combined = Self.join(kept, text)
            guard combined != lastPartial else { return nil }
            lastPartial = combined
            return .partial(combined)
        case .transcript(let text, isFinal: true):
            if isBlank(text) { return finish().map(Emission.final) }
            keepDroppedWords(before: text)
            let settled = Self.normalized(text).hasPrefix(Self.normalized(kept)) ? text : Self.join(kept, text)
            reset()
            return .final(settled)
        case .noSpeech:
            let settled = kept
            reset()
            return .final(settled)
        case .failure:
            return finish().map(Emission.final)
        }
    }

    /// Ends the utterance when its task stops without a final result: the last partial becomes the final text.
    public mutating func finish() -> String? {
        defer { reset() }
        return lastPartial.isEmpty ? nil : lastPartial
    }

    /// Whether `next` starts a new transcription instead of revising `previous`. Apple's revisions keep about as many
    /// words (a corrected opening word, "a neural network" becoming "the neural network", keeps them all), while a
    /// restart begins again from the newest words, so a text that falls to half the words or fewer is a restart,
    /// even when it opens with the same word ("The first class uses sigmoid" becoming "The second").
    public static func restarted(from previous: String, to next: String) -> Bool {
        let old = words(previous).count, new = words(next).count
        return old >= 2 && new > 0 && new * 2 <= old
    }

    private mutating func keepDroppedWords(before text: String) {
        guard Self.restarted(from: segment, to: text) else { return }
        kept = Self.join(kept, segment)
    }

    private mutating func reset() {
        lastPartial = ""
        kept = ""
        segment = ""
    }

    private static func join(_ head: String, _ tail: String) -> String {
        let head = head.trimmingCharacters(in: .whitespacesAndNewlines)
        let tail = tail.trimmingCharacters(in: .whitespacesAndNewlines)
        if head.isEmpty { return tail }
        return tail.isEmpty ? head : head + " " + tail
    }

    private static func words(_ text: String) -> [String] {
        normalized(text).split(separator: " ").map(String.init)
    }

    /// Lowercased words without punctuation, separated by single spaces.
    private static func normalized(_ text: String) -> String {
        let letters = text.lowercased().map { $0.isLetter || $0.isNumber ? $0 : " " }
        return String(letters).split(separator: " ").joined(separator: " ")
    }

    private func isBlank(_ text: String) -> Bool {
        text.allSatisfy(\.isWhitespace)
    }
}
