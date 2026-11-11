/// Finds the end of an utterance in the audio itself. Apple Speech marks a result final only when its task ends,
/// so without this a spoken sentence stayed provisional until the fifty-second rotation.
public struct PauseDetector: Equatable, Sendable {
    /// Root-mean-square level below which a microphone chunk counts as silence (-38 dBFS). A noise-suppressed
    /// microphone still rises to about 0.003 between words, so a lower gate would rarely see a pause.
    public static let microphoneSilenceLevel: Float = 0.012
    /// System output is digital silence between sentences but can speak far more quietly than a microphone;
    /// the microphone gate classified its quiet words as silence and cut a sentence's tail (-60 dBFS).
    public static let systemSilenceLevel: Float = 0.001
    /// Silence after speech that ends an utterance: 0.9 s of audio.
    public static let pauseSamples = SessionAudio.sampleRate * 9 / 10

    /// The gate for one speaker of a live session: `.they` is system output, `.me` the microphone.
    public static func silenceLevel(for speaker: Speaker) -> Float {
        switch speaker {
        case .me: microphoneSilenceLevel
        case .they: systemSilenceLevel
        }
    }

    /// The level below which a chunk counts as silence.
    public let silenceLevel: Float
    /// Whether speech was heard since the last pause.
    public private(set) var heardSpeech = false
    /// How many silent samples followed the last speech.
    public private(set) var silentSamples = 0

    /// Creates a detector that has heard nothing yet.
    public init(silenceLevel: Float = PauseDetector.microphoneSilenceLevel) {
        self.silenceLevel = silenceLevel
    }

    /// Records one chunk and reports whether it completes a pause that follows speech.
    /// A pause is reported once; the next one needs speech again.
    public mutating func endsUtterance(after samples: [Float]) -> Bool {
        guard samples.isEmpty == false else { return false }
        let level = (samples.reduce(Float(0)) { $0 + $1 * $1 } / Float(samples.count)).squareRoot()
        if level >= silenceLevel {
            heardSpeech = true
            silentSamples = 0
            return false
        }
        silentSamples += samples.count
        guard heardSpeech, silentSamples >= Self.pauseSamples else { return false }
        heardSpeech = false
        silentSamples = 0
        return true
    }
}
