/// The one notion of locale equivalence between identifiers from different APIs, which differ only in
/// separator and case ("en_US" vs "en-us").
public enum LocaleMatching {
    /// `identifier` with hyphens for separators, in lowercase.
    public static func normalized(_ identifier: String) -> String {
        identifier.replacing("_", with: "-").lowercased()
    }

    /// Whether two identifiers name the same locale.
    public static func areEquivalent(_ first: String, _ second: String) -> Bool {
        normalized(first) == normalized(second)
    }
}
