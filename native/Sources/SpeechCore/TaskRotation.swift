/// Live recognition runs in bounded tasks: after fifty seconds of audio the task is finished and a new one
/// starts, which keeps on-device recognition responsive.
public enum TaskRotation {
    /// The most audio one task takes: fifty seconds.
    public static let maximumSamplesPerTask = SessionAudio.samples(inSeconds: 50)

    /// Whether adding `count` samples to a task holding `current` would exceed the limit.
    public static func shouldRotate(current: Int, adding count: Int) -> Bool {
        current + count > maximumSamplesPerTask
    }
}
