/// One recognition task of a live session. The boundary is injectable so delayed callbacks and input gaps
/// can be tested without Speech permission.
@MainActor
protocol StreamingRecognitionTask {
    /// Queues samples for recognition.
    func append(_ samples: [Float]) throws
    /// Says no more audio follows; the task reports its remaining outcomes and then ends.
    func endAudio()
    /// Stops the task without waiting for its outcomes.
    func cancel()
}
