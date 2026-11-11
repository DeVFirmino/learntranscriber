import AppKit
import ApplicationServices
import ContextCore
import HelperKit

/// Accessibility-based selection reading. It never reads secure text fields.
@MainActor
public struct AccessibilitySelection: SelectionReading {
    /// How long, in seconds, one Accessibility request waits for an unresponsive application.
    private static let messagingTimeout: Float = 0.5

    /// Creates a reader backed by the system Accessibility API.
    public init() {}

    public var isTrusted: Bool { AXIsProcessTrusted() }

    public func selection(excludingProcess excludedProcess: pid_t?) throws -> Selection? {
        guard isTrusted else {
            throw HelperError("Enable Accessibility for LearnTranscriber in macOS Privacy & Security, then restart the app.")
        }
        guard let application = NSWorkspace.shared.frontmostApplication,
              application.processIdentifier != excludedProcess else { return nil }
        let appElement = AXUIElementCreateApplication(application.processIdentifier)
        AXUIElementSetMessagingTimeout(appElement, Self.messagingTimeout)
        var focused: CFTypeRef?
        guard AXUIElementCopyAttributeValue(appElement, kAXFocusedUIElementAttribute as CFString, &focused) == .success,
              let focused, CFGetTypeID(focused) == AXUIElementGetTypeID() else { return nil }
        let element = unsafeDowncast(focused, to: AXUIElement.self)
        AXUIElementSetMessagingTimeout(element, Self.messagingTimeout)
        var subrole: CFTypeRef?
        AXUIElementCopyAttributeValue(element, kAXSubroleAttribute as CFString, &subrole)
        guard subrole as? String != kAXSecureTextFieldSubrole as String else { return nil }
        var value: CFTypeRef?
        guard AXUIElementCopyAttributeValue(element, kAXSelectedTextAttribute as CFString, &value) == .success,
              let text = value as? String else { return nil }
        return Selection(text: ContextBounds.clip(text), application: application.localizedName)
    }
}
