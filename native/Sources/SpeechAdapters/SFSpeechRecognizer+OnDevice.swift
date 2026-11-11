import Speech
import SpeechCore

extension SFSpeechRecognizer {
    /// An on-device recognizer for the locale `identifier` names.
    ///
    /// - Throws: `SpeechFailure.unsupportedLocale` when Apple Speech does not know the locale,
    ///   `SpeechFailure.onDeviceUnavailable` when it cannot recognize it on this device.
    static func onDevice(locale identifier: String) throws -> SFSpeechRecognizer {
        guard let recognizer = SFSpeechRecognizer(locale: Locale(identifier: identifier)) else { throw SpeechFailure.unsupportedLocale }
        guard recognizer.supportsOnDeviceRecognition else { throw SpeechFailure.onDeviceUnavailable }
        return recognizer
    }
}
