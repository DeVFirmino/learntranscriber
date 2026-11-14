import Foundation

/// Saves a long utterance sentence by sentence instead of all at once when its task ends, so a class transcript
/// grows while the speaker talks and a recognizer reset can only lose words that were never saved.
///
/// A sentence is saved when it ends with `.`, `?` or `!` and has at least 12 characters and 3 words; shorter ones
/// join the next. Speech that runs on without punctuation is saved after 7 seconds once it holds 6 words and 32
/// characters. Apple keeps revising its text, so the saved words are found again in each new text by aligning
/// words, and a sentence that repeats the last saved one is not saved twice.
public struct SentenceCommitter: Equatable, Sendable {
    /// What one running text makes the session emit.
    public struct Update: Equatable, Sendable {
        /// Sentences to save now, in order.
        public var finals: [String]
        /// The rest of the utterance, still provisional.
        public var partial: String

        public init(finals: [String], partial: String) {
            self.finals = finals
            self.partial = partial
        }
    }

    public static let minimumSentenceCharacters = 12
    public static let minimumSentenceWords = 3
    public static let continuousSamples = SessionAudio.samples(inSeconds: 7)
    public static let minimumFlushCharacters = 32
    public static let minimumFlushWords = 6
    /// Revisions may change this many words at either edge of the saved text and still count as the same text.
    static let alignmentSlack = 2

    /// Normalized words of this utterance already saved.
    private var saved: [String] = []
    /// Where in the task's audio the unsaved speech began.
    private var unsavedSince: Int?
    /// The last saved text, normalized, so a repeat is skipped.
    private var lastSaved = ""

    public init() {}

    /// Splits the utterance's running `text` into sentences to save now and the provisional rest; `sample` is the
    /// task's audio position, which times speech that runs on without punctuation.
    public mutating func update(_ text: String, at sample: Int) -> Update {
        var rest = unsaved(in: text)
        guard rest.isEmpty == false else {
            unsavedSince = nil
            return Update(finals: [], partial: "")
        }
        if unsavedSince == nil { unsavedSince = sample }
        var finals: [String] = []
        var sentence: [String] = []
        var taken = 0
        for (index, token) in rest.enumerated() {
            sentence.append(token)
            guard Self.endsSentence(token) else { continue }
            let candidate = sentence.joined(separator: " ")
            guard candidate.count >= Self.minimumSentenceCharacters,
                  TextAlignment.words(candidate).count >= Self.minimumSentenceWords else { continue }
            save(candidate, into: &finals)
            sentence = []
            taken = index + 1
        }
        rest.removeFirst(taken)
        let remaining = rest.joined(separator: " ")
        if let start = unsavedSince, finals.isEmpty, sample - start >= Self.continuousSamples,
           remaining.count >= Self.minimumFlushCharacters, TextAlignment.words(remaining).count >= Self.minimumFlushWords {
            save(remaining, into: &finals)
            unsavedSince = nil
            return Update(finals: finals, partial: "")
        }
        if finals.isEmpty == false { unsavedSince = remaining.isEmpty ? nil : sample }
        return Update(finals: finals, partial: remaining)
    }

    /// The part of the utterance's settled `text` not saved yet, which ends the utterance. Nil when its sentences
    /// were all saved already, so no empty final follows them; an utterance with nothing saved still ends with "".
    public mutating func finish(_ text: String) -> String? {
        let rest = unsaved(in: text).joined(separator: " ")
        let savedBefore = saved.isEmpty == false
        reset()
        guard rest.isEmpty == false, isRepeat(rest) == false else { return savedBefore ? nil : "" }
        lastSaved = TextAlignment.normalized(rest)
        return rest
    }

    /// Starts a new utterance; the last saved text is still remembered so a repeat across tasks is skipped.
    public mutating func reset() {
        saved = []
        unsavedSince = nil
    }

    private mutating func save(_ text: String, into finals: inout [String]) {
        saved += TextAlignment.words(text)
        guard isRepeat(text) == false else { return }
        lastSaved = TextAlignment.normalized(text)
        finals.append(text)
    }

    /// The tokens of `text` after the words already saved.
    private func unsaved(in text: String) -> [String] {
        let tokens = text.split(whereSeparator: \.isWhitespace).map(String.init)
        guard saved.isEmpty == false else { return tokens }
        let words = tokens.map(TextAlignment.word)
        if let end = TextAlignment.alignedEnd(of: saved, in: words, slack: Self.alignmentSlack) { return Array(tokens[end...]) }
        // The recognizer rewrote the saved words beyond recognition: skip as many words as were saved.
        return Array(tokens.dropFirst(min(saved.count, tokens.count)))
    }

    /// Whether `text` repeats the last saved text, exactly or at 90% character similarity.
    private func isRepeat(_ text: String) -> Bool {
        let normalized = TextAlignment.normalized(text)
        guard normalized.isEmpty == false, lastSaved.isEmpty == false else { return false }
        return normalized == lastSaved || TextAlignment.similarity(normalized, lastSaved) >= 0.9
    }

    private static func endsSentence(_ token: String) -> Bool {
        let trimmed = token.trimmingCharacters(in: CharacterSet(charactersIn: "\"'”’)]"))
        guard let last = trimmed.last else { return false }
        return ".?!…".contains(last) && trimmed.hasSuffix("..") == false
    }

}
