/// How long the helper waits for Apple Speech before giving up.
public enum SpeechTimeouts {
    /// One file transcription, on either engine.
    public static let fileRecognition: Duration = .seconds(60)
    /// A live task draining its queued audio after its input ended. Recognition can lag well behind the audio,
    /// especially for system output, so a short limit would drop the final callback holding the last words.
    public static let taskDrain: Duration = .seconds(10)
    /// No live input for this long ends the current utterance: a capture source may stop sending during silence.
    public static let inputIdle: Duration = .seconds(1)
}
