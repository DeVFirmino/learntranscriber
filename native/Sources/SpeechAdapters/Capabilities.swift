import Speech
import SpeechCore

/// What this Mac can recognize for a locale, answered without prompting for permission.
public enum SpeechCapabilities {
    /// Reports both engines' support for `locale`, the permission state and the supported locales.
    public static func query(locale: String) async -> CapabilitiesResponse {
        let recognizer = SFSpeechRecognizer(locale: Locale(identifier: locale))
        var modernReady = false
        if #available(macOS 26.0, *) { modernReady = await ModernSpeech.isInstalled(for: locale) }
        let classicReady = recognizer?.supportsOnDeviceRecognition ?? false
        return CapabilitiesResponse(locale: locale,
                                    authorization: SpeechAuthorization.statusName,
                                    supportsOnDeviceRecognition: modernReady || classicReady,
                                    supportsStreamingRecognition: classicReady,
                                    locales: SFSpeechRecognizer.supportedLocales().map(\.identifier).sorted(),
                                    engine: modernReady ? .speechTranscriber : .sfSpeechRecognizer)
    }
}
