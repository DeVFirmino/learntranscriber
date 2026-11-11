/// Text selected in another app, with the app's name when it is known.
public struct Selection: Equatable, Sendable {
    /// The selected text.
    public var text: String
    /// The localized name of the application that owns the selection.
    public var application: String?

    /// Creates a selection of `text` made in `application`.
    public init(text: String, application: String? = nil) {
        self.text = text
        self.application = application
    }
}
