/// What this Mac can recognize for a locale, answered without prompting for permission.
public struct CapabilitiesResponse: Encodable, Equatable, Sendable {
    /// The engine file transcription would use; the raw values are the protocol's `engine` field.
    public enum Engine: String, Encodable, Sendable {
        /// The macOS 26 SpeechAnalyzer stack, chosen when the locale's assets are installed.
        case speechTranscriber = "SpeechTranscriber"
        /// The classic recognizer.
        case sfSpeechRecognizer = "SFSpeechRecognizer"
    }

    /// The locale asked about, as given.
    public var locale: String
    /// The Speech Recognition permission: authorized, denied, restricted, notDetermined or unknown.
    public var authorization: String
    /// Whether either engine can transcribe this locale on this device.
    public var supportsOnDeviceRecognition: Bool
    /// Whether live sessions can recognize this locale on this device.
    public var supportsStreamingRecognition: Bool
    /// Every locale the classic recognizer supports, sorted.
    public var locales: [String]
    /// The engine file transcription would use.
    public var engine: Engine

    /// Creates the reply.
    public init(locale: String, authorization: String, supportsOnDeviceRecognition: Bool,
                supportsStreamingRecognition: Bool, locales: [String], engine: Engine) {
        self.locale = locale
        self.authorization = authorization
        self.supportsOnDeviceRecognition = supportsOnDeviceRecognition
        self.supportsStreamingRecognition = supportsStreamingRecognition
        self.locales = locales
        self.engine = engine
    }
}
