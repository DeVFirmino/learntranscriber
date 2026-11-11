import SpeechCore

/// Receives the events of one live session, in order.
@MainActor
public protocol SessionEventSink {
    /// Delivers one event.
    func emit(_ event: SessionEvent)
}
