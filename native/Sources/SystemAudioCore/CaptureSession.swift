import Foundation

/// Runs one capture from start to stop and writes its protocol lines in order: `started`, the audio and device
/// lines, an `error` line if the capture failed, and `stopped`.
@MainActor
public struct CaptureSession {
    /// Which side of the session ended it.
    private enum Ending: Sendable {
        case stopRequested
        case captureEnded
    }

    private let capture: any AudioCapturing
    private let options: CaptureOptions
    private let write: @MainActor (AudioPacket) -> Void

    /// Creates a session that runs `capture` with `options` and hands every line to `write`.
    public init(capture: some AudioCapturing, options: CaptureOptions, write: @escaping @MainActor (AudioPacket) -> Void) {
        self.capture = capture
        self.options = options
        self.write = write
    }

    /// Starts the capture and streams packets until `stopRequests` yields, ends or fails, or the capture ends on
    /// its own; whichever comes first wins, the capture is stopped and the other side is cancelled.
    ///
    /// Audio is batched to `options.packetBytes`; the batch is flushed before any other line, so lines keep the
    /// order of the events. A capture that fails after starting reports an `error` line and still ends with
    /// `stopped`.
    ///
    /// - Parameter stopRequests: The app's stop requests; it must end its wait when cancelled.
    /// - Throws: The capture's error when it cannot start, after stopping it; nothing has been written then.
    public func run<StopRequests: AsyncSequence & Sendable>(until stopRequests: StopRequests) async throws {
        let events = try await start()
        write(.started)
        let write = write
        let packetBytes = options.packetBytes
        await withTaskGroup(of: Ending.self) { group in
            group.addTask {
                await Self.pump(events, packetBytes: packetBytes, write: write)
                return .captureEnded
            }
            group.addTask {
                do {
                    for try await _ in stopRequests { break }
                } catch {}
                return .stopRequested
            }
            let ending = await group.next()
            // Stopping finishes the events stream, so a pump still running drains what is buffered and returns.
            await capture.stop()
            if ending == .captureEnded { group.cancelAll() }
        }
        write(.stopped)
    }

    /// Starts the capture, stopping it again when the start fails.
    private func start() async throws -> AsyncThrowingStream<CaptureEvent, any Error> {
        do {
            return try await capture.start(options)
        } catch {
            await capture.stop()
            throw error
        }
    }

    /// Writes the events as packets until the stream ends; never cancelled, so no buffered event is dropped.
    private static func pump(
        _ events: AsyncThrowingStream<CaptureEvent, any Error>, packetBytes: Int, write: @MainActor (AudioPacket) -> Void
    ) async {
        var batcher = PacketBatcher(limit: packetBytes)
        func flush() {
            if let pending = batcher.flush() { write(.audio(pending)) }
        }
        do {
            for try await event in events {
                switch event {
                case .audio(let chunk):
                    if let packet = batcher.append(chunk) { write(.audio(packet)) }
                case .reconnecting(let reason):
                    flush()
                    write(.reconnecting(reason))
                case .deviceChanged(let id, let name):
                    flush()
                    write(.deviceChanged(id: id, name: name))
                }
            }
            flush()
        } catch {
            flush()
            write(.failure(error.localizedDescription))
        }
    }
}
