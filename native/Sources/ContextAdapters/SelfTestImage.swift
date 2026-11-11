import AppKit
import ContextCore
import HelperKit

/// Draws the self-test sentence so OCR can be verified without capturing a screen.
public enum SelfTestImage {
    /// The canvas: wide enough for the sentence on one line at `fontSize`.
    private static let size = NSSize(width: 900, height: 120)
    /// Where the sentence's baseline starts, in points from the bottom-left corner.
    private static let textOrigin = NSPoint(x: 20, y: 40)
    /// Large enough for Vision's accurate recognizer to read every character.
    private static let fontSize: CGFloat = 38

    /// Black `ContextSelfTest.text` on a white canvas.
    ///
    /// - Throws: A `HelperError` when AppKit cannot produce a bitmap.
    @MainActor
    public static func render() throws -> CGImage {
        let image = NSImage(size: size, flipped: false) { bounds in
            NSColor.white.setFill()
            bounds.fill()
            (ContextSelfTest.text as NSString).draw(
                at: textOrigin, withAttributes: [.font: NSFont.systemFont(ofSize: fontSize), .foregroundColor: NSColor.black])
            return true
        }
        guard let cgImage = image.cgImage(forProposedRect: nil, context: nil, hints: nil) else {
            throw HelperError("Could not prepare the OCR test image.")
        }
        return cgImage
    }
}
