/// A language reservation the app gave up.
public struct AssetReleaseResponse: Encodable, Equatable, Sendable {
    /// The framework's identifier for the released language.
    public var locale: String
    /// Always true: this reply exists only where language management does.
    public let assetManagementAvailable = true
    /// Whether the framework reports the reservation as released.
    public var released: Bool

    /// Creates the reply.
    public init(locale: String, released: Bool) {
        self.locale = locale
        self.released = released
    }
}
