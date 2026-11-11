/// The languages of the macOS 26 speech stack, as identifiers sorted alphabetically.
public struct AssetListResponse: Encodable, Equatable, Sendable {
    /// Every language the modern engine supports.
    public var locales: [String]
    /// The languages whose assets are on this Mac.
    public var installedLocales: [String]
    /// The languages this app holds a reservation for.
    public var reservedLocales: [String]
    /// How many reservations the app may hold at once.
    public var maximumReservedLocales: Int
    /// Always true: this reply exists only where language management does.
    public let assetManagementAvailable = true

    /// Creates the reply.
    public init(locales: [String], installedLocales: [String], reservedLocales: [String], maximumReservedLocales: Int) {
        self.locales = locales
        self.installedLocales = installedLocales
        self.reservedLocales = reservedLocales
        self.maximumReservedLocales = maximumReservedLocales
    }
}
