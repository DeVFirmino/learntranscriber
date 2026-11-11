/// A language that is now reserved and installed.
public struct AssetInstallResponse: Encodable, Equatable, Sendable {
    /// The framework's identifier for the installed language.
    public var locale: String
    /// Always true: this reply exists only where language management does.
    public let assetManagementAvailable = true
    /// Always `"installed"`: a download that does not end installed is an error instead.
    public let assetStatus = "installed"

    /// Creates the reply.
    public init(locale: String) { self.locale = locale }
}
