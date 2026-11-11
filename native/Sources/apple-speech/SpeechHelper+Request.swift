extension SpeechHelper {
    /// The one reply a run without `--mode` answers.
    enum Request: Equatable {
        /// A language management operation.
        case assets(AssetOperation)
        /// What this Mac can recognize for `--locale`.
        case capabilities
        /// Transcribe the audio file at this path.
        case transcribe(audio: String)
    }

    /// What `--list-assets`, `--install-locale` and `--release-locale` ask for.
    enum AssetOperation: Equatable {
        /// List supported, installed and reserved languages.
        case list
        /// Reserve and download the language given by `--locale`.
        case install
        /// Release the reservation of the language given by `--locale`.
        case release
    }
}
