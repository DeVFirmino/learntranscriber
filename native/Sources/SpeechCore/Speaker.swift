/// Who a live session hears; the raw values are the labels of the app protocol.
public enum Speaker: String, CaseIterable, Sendable {
    /// The person using the app, through the microphone.
    case me = "ME"
    /// Everyone else, through the system audio output.
    case they = "THEY"
}
