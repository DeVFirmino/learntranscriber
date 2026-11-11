import Darwin
import Foundation

extension ContextHelper {
    /// The one thing a run of the helper answers, decided while parsing.
    enum Mode: Equatable {
        /// Report whether Accessibility access is granted.
        case status
        /// Read the frontmost selection unless the frontmost application is the excluded process.
        case selection(excluding: pid_t?)
        /// Recognize the text in the image file at this location.
        case image(URL)
        /// Recognize the text in the built-in test image.
        case selfTest
    }
}
