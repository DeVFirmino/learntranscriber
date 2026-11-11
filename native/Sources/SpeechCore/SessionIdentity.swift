import Foundation

/// Which session a live stream belongs to and which speaker it hears.
public struct SessionIdentity: Equatable, Sendable {
    /// The longest session id the helper accepts.
    public static let maximumSessionIdLength = 100

    /// The session id the app passed.
    public let sessionId: String
    /// The speaker this stream hears.
    public let speaker: Speaker
    /// The locale recognition runs in.
    public let locale: String

    /// Validates the session arguments: a known speaker label and a bounded session id.
    ///
    /// - Parameters:
    ///   - language: The requested locale; absent or `"auto"` means `defaultLocale`.
    ///   - defaultLocale: The locale `"auto"` resolves to, the system locale unless a test supplies one.
    /// - Throws: `SpeechFailure.invalidArguments` when the id or the speaker is missing or invalid.
    public init(sessionId: String?, speakerLabel: String?, language: String?,
                defaultLocale: @autoclosure () -> String = Locale.current.identifier) throws {
        guard let sessionId, sessionId.count <= Self.maximumSessionIdLength,
              let speakerLabel, let speaker = Speaker(rawValue: speakerLabel) else {
            throw SpeechFailure.invalidArguments
        }
        self.sessionId = sessionId
        self.speaker = speaker
        let requested = language ?? "auto"
        locale = requested == "auto" ? defaultLocale() : requested
    }

    /// Makes an event of this session. Error events carry no resolved locale; every other kind does.
    public func makeEvent(_ kind: SessionEvent.Kind, text: String? = nil, assetStatus: String? = nil,
                          error: String? = nil) -> SessionEvent {
        SessionEvent(kind: kind, sessionId: sessionId, speakerLabel: speaker.rawValue, text: text,
                     resolvedLocale: error == nil ? locale : nil, assetStatus: assetStatus, error: error)
    }
}
