/// One line of the live session protocol: ready, partial, final or error.
public struct SessionEvent: Encodable, Equatable, Sendable {
    /// What an event announces; the raw values are the protocol's `type` field.
    public enum Kind: String, Encodable, Sendable {
        /// The session can take audio.
        case ready
        /// Provisional text of the current utterance; a later partial or final replaces it.
        case partial
        /// The settled text of an utterance; empty when the recognizer heard no speech.
        case final
        /// The session failed; `error` says why.
        case error
    }

    /// What this event announces, encoded as `type`.
    public var kind: Kind
    /// The session the event belongs to, as the app passed it.
    public var sessionId: String
    /// The speaker the event belongs to, as the app passed it, even when it is not a known `Speaker`.
    public var speakerLabel: String
    /// The recognized text of a partial or final event.
    public var text: String?
    /// The locale recognition runs in; absent from error events.
    public var resolvedLocale: String?
    /// The language asset state of a ready event.
    public var assetStatus: String?
    /// The message of an error event.
    public var error: String?

    /// Creates an event; absent optional fields are left out of the JSON line.
    public init(kind: Kind, sessionId: String, speakerLabel: String, text: String? = nil,
                resolvedLocale: String? = nil, assetStatus: String? = nil, error: String? = nil) {
        self.kind = kind
        self.sessionId = sessionId
        self.speakerLabel = speakerLabel
        self.text = text
        self.resolvedLocale = resolvedLocale
        self.assetStatus = assetStatus
        self.error = error
    }

    private enum CodingKeys: String, CodingKey {
        case kind = "type"
        case sessionId, speakerLabel, text, resolvedLocale, assetStatus, error
    }
}
