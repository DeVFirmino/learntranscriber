/// The reply of a one-shot run that failed.
public struct ErrorResponse: Encodable, Equatable, Sendable {
    /// Why the run failed, in words meant for the person using the app.
    public var error: String

    /// Creates the reply.
    public init(error: String) { self.error = error }
}
