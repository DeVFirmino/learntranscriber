import HelperKit
import SpeechAdapters
import SpeechCore

/// Writes session events as JSON lines on standard output.
@MainActor
struct StandardOutputSink: SessionEventSink {
    func emit(_ event: SessionEvent) { LineWriter.write(event) }
}
