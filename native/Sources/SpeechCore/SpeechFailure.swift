import Foundation

/// A user-facing failure from the local speech recognition helper. Every message lives in `errorDescription`.
public enum SpeechFailure: Error, LocalizedError, Equatable {
    /// The command line names no mode, misses a value or names an audio file that does not exist.
    case invalidArguments
    /// Speech Recognition is not authorized for the app.
    case permissionDenied
    /// Apple Speech does not recognize this locale at all.
    case unsupportedLocale
    /// The locale is supported, but not on this device.
    case onDeviceUnavailable
    /// The modern engine supports the locale, but its language assets are not installed.
    case languageNotInstalled
    /// Installing a language needs a reservation and every reservation slot is taken.
    case languageCapacityFull
    /// Releasing a language the app never reserved.
    case localeNotReserved
    /// Live audio that is not whole 16-bit samples.
    case malformedAudio
    /// Apple Speech could not allocate a buffer for live audio.
    case audioBufferUnavailable
    /// The recognizer failed; the message is the framework's own description of the failure.
    case recognitionFailed(String)
    /// Recognition did not finish within its time limit.
    case timedOut

    public var errorDescription: String? {
        switch self {
        case .invalidArguments: "Supply --capabilities or --audio <file> and --locale <locale>."
        case .permissionDenied: "Enable Speech Recognition for LearnTranscriber in macOS Privacy & Security."
        case .unsupportedLocale: "Apple Speech does not support this locale. Choose another locale."
        case .onDeviceUnavailable: "On-device recognition is unavailable for this locale. Install the relevant macOS language assets or choose another transcription source."
        case .languageNotInstalled: "Install this Apple Speech language in Audio & transcription before listening."
        case .languageCapacityFull: "Language capacity is full. Release an unused reservation before installing another language."
        case .localeNotReserved: "This language is not reserved by the app."
        case .malformedAudio: "Live audio must be whole 16-bit PCM samples."
        case .audioBufferUnavailable: "Apple Speech could not prepare the audio buffer."
        case .recognitionFailed(let message): message
        case .timedOut: "Local speech recognition timed out. The audio segment can be retried."
        }
    }
}
