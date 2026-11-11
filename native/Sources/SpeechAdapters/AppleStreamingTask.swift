import AVFAudio
import Speech
import SpeechCore

/// An `SFSpeechAudioBufferRecognitionRequest` task that reports each callback, in order, on the main actor.
@MainActor
final class AppleStreamingTask: StreamingRecognitionTask {
    private let request = SFSpeechAudioBufferRecognitionRequest()
    private var task: SFSpeechRecognitionTask?

    /// Starts an on-device dictation task; `receive` gets every outcome.
    init(recognizer: SFSpeechRecognizer, receive: @escaping StreamingRecognizer.OutcomeHandler) {
        request.requiresOnDeviceRecognition = true
        request.shouldReportPartialResults = true
        request.taskHint = .dictation
        task = recognizer.recognitionTask(with: request) { result, error in
            let outcome = StreamingTaskOutcome(text: result?.bestTranscription.formattedString,
                                               isFinal: result?.isFinal ?? false, error: error)
            Task { @MainActor in receive(outcome) }
        }
    }

    /// - Throws: `SpeechFailure.audioBufferUnavailable` when no buffer can hold the samples.
    func append(_ samples: [Float]) throws {
        guard let format = AVAudioFormat(standardFormatWithSampleRate: Double(SessionAudio.sampleRate), channels: 1),
              let buffer = AVAudioPCMBuffer(pcmFormat: format, frameCapacity: AVAudioFrameCount(samples.count)),
              let channel = buffer.floatChannelData?.pointee else {
            throw SpeechFailure.audioBufferUnavailable
        }
        buffer.frameLength = AVAudioFrameCount(samples.count)
        for (index, sample) in samples.enumerated() { channel[index] = sample }
        request.append(buffer)
    }

    func endAudio() { request.endAudio() }
    func cancel() { task?.cancel() }
}
