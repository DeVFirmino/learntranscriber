import Foundation

/// A failure with a message meant for the person using the app.
public struct HelperError: Error, LocalizedError, Equatable {
    /// The sentence shown to the person, sent unchanged as the JSON line's `error`.
    public let message: String

    /// Creates an error that reports `message`.
    public init(_ message: String) { self.message = message }

    /// The `message`, so `localizedDescription` reports it verbatim.
    public var errorDescription: String? { message }
}
