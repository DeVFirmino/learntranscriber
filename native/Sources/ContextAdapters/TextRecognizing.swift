import CoreGraphics
import Foundation

/// Recognizes text in an image entirely on this device.
public protocol TextRecognizing {
    /// The text recognized in the image file at `url`, one line per recognized line.
    func text(inImageAt url: URL) throws -> String
    /// The text recognized in `image`, one line per recognized line.
    func text(in image: CGImage) throws -> String
}
