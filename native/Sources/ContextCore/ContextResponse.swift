/// The bounded reply the desktop app reads from the context helper. Absent fields are left out of the JSON line.
public struct ContextResponse: Encodable, Equatable, Sendable {
    /// Selected or recognized text, already clipped to `ContextBounds.maximumCharacters`.
    public var text: String?
    /// The name of the application the selection came from, when it is known.
    public var application: String?
    /// Whether Accessibility access is granted; sent only by `--status`.
    public var trusted: Bool?
    /// A message for the person using the app; present only on failure.
    public var error: String?

    /// Creates a reply carrying only the given fields.
    public init(text: String? = nil, application: String? = nil, trusted: Bool? = nil, error: String? = nil) {
        self.text = text
        self.application = application
        self.trusted = trusted
        self.error = error
    }
}
