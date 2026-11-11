import Foundation

/// Live recognition for one speaker of one session, fed by the command's input loop.
@MainActor
public protocol LiveRecognizing {
    /// Tells the app the session can take audio.
    func announceReady()
    /// Feeds whole little-endian PCM16 samples.
    ///
    /// - Throws: `SpeechFailure.malformedAudio` for an odd byte count, or the recognizer's failure.
    func append(_ data: Data) async throws
    /// Reports that the input went quiet without closing; the current utterance ends.
    func inputPaused() async
    /// Ends recognition, letting it drain the audio it already has.
    func stop() async
}
