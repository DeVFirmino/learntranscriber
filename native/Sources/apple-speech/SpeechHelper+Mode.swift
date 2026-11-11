import ArgumentParser

extension SpeechHelper {
    /// The value of `--mode`. Without it the command answers one request and exits.
    enum Mode: String, ExpressibleByArgument {
        /// Stream PCM16 from standard input and write live session events.
        case session
    }
}
