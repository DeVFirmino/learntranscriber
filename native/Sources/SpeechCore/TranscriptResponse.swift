/// The text of a transcribed file.
public struct TranscriptResponse: Encodable, Equatable, Sendable {
    /// Everything recognized in the file.
    public var text: String
    /// The locale recognition ran in, as given.
    public var locale: String

    /// Creates the reply.
    public init(text: String, locale: String) {
        self.text = text
        self.locale = locale
    }
}
