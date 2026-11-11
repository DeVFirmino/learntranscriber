import HelperKit

/// Limits that keep context payloads small: at most ``maximumCharacters`` characters of text, and images of at most
/// ``maximumImageBytes`` bytes.
public enum ContextBounds {
    /// The most characters of text a reply carries.
    public static let maximumCharacters = 20_000
    /// The largest image, in bytes, that OCR accepts.
    public static let maximumImageBytes = 20_000_000

    /// Decimal megabytes, the unit the image limit is reported in.
    private static let bytesPerMegabyte = 1_000_000

    /// The first ``maximumCharacters`` characters of `text`.
    public static func clip(_ text: String) -> String { String(text.prefix(maximumCharacters)) }

    /// Refuses an image of `bytes` bytes when it is larger than ``maximumImageBytes``.
    ///
    /// - Throws: A `HelperError` naming the limit in megabytes.
    public static func checkImage(bytes: Int) throws {
        guard bytes <= maximumImageBytes else {
            throw HelperError("Image exceeds the \(maximumImageBytes / bytesPerMegabyte) MB OCR limit.")
        }
    }

    /// The recognized `lines` joined with newlines, clipped to ``maximumCharacters`` characters.
    public static func clippedText(joining lines: [String]) -> String { clip(lines.joined(separator: "\n")) }
}
