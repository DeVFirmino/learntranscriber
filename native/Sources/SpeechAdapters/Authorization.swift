import Speech
import SpeechCore

/// Speech Recognition permission, asked only by the modes that transcribe.
public enum SpeechAuthorization {
    /// Prompts the user if needed and fails when recognition is not authorized.
    ///
    /// - Throws: `SpeechFailure.permissionDenied` unless the user authorized recognition.
    public static func require() async throws {
        let status = await withCheckedContinuation { continuation in
            SFSpeechRecognizer.requestAuthorization { continuation.resume(returning: $0) }
        }
        guard status == .authorized else { throw SpeechFailure.permissionDenied }
    }

    /// The current status as the protocol spells it, without prompting.
    public static var statusName: String {
        switch SFSpeechRecognizer.authorizationStatus() {
        case .authorized: "authorized"
        case .denied: "denied"
        case .restricted: "restricted"
        case .notDetermined: "notDetermined"
        @unknown default: "unknown"
        }
    }
}
