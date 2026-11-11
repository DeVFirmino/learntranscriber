/// Chooses the engine that transcribes files.
public enum FileRecognizers {
    /// The modern engine when the locale's language assets are installed, else the SFSpeechRecognizer engine.
    public static func preferred(locale: String) async -> any FileRecognizing {
        if #available(macOS 26.0, *), await ModernSpeech.isInstalled(for: locale) { return ModernFileRecognizer(locale: locale) }
        return ClassicFileRecognizer(locale: locale)
    }
}
