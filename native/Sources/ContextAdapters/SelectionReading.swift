import ContextCore
import Darwin

/// Reads the text selected in the frontmost application.
@MainActor
public protocol SelectionReading {
    /// Whether this process may use Accessibility; false means the user has not granted it.
    var isTrusted: Bool { get }
    /// The selection in the focused element, or `nil` when there is none, the frontmost app is `excludedProcess`,
    /// or the field is a secure one.
    func selection(excludingProcess excludedProcess: pid_t?) throws -> Selection?
}
