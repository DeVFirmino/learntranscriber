import Foundation

/// Runs `operation` and fails with `failure` if it has not finished after `duration`.
///
/// The outcome is settled here, not in the timer: whichever child finishes first decides, so `onTimeout`
/// runs only when the timer won and never against an operation that already succeeded. The losing side is
/// cancelled, so a timed-out operation does not keep running; task cancellation is cooperative, so an
/// operation driving an external producer passes `onTimeout` to stop that producer explicitly before the
/// group waits for it. An error the operation throws within the deadline wins over `failure`, and
/// cancelling the calling task cancels both children.
public func withTimeout<Value: Sendable>(
    _ duration: Duration,
    failure: @autoclosure () -> any Error,
    onTimeout: (@Sendable () async -> Void)? = nil,
    operation: @escaping @Sendable () async throws -> Value
) async throws -> Value {
    try await withThrowingTaskGroup(of: TimeoutOutcome<Value>.self) { group in
        defer { group.cancelAll() }
        group.addTask {
            let value = try await operation()
            return .value(value)
        }
        group.addTask {
            try await Task.sleep(for: duration)
            return .timedOut
        }
        switch try await group.next() {
        case .value(let value)?:
            return value
        case .timedOut?:
            await onTimeout?()
            throw failure()
        case nil:
            preconditionFailure("The group always holds the operation and the timer.")
        }
    }
}

/// What one child of `withTimeout` reports: the operation's value, or that the timer fired first.
private enum TimeoutOutcome<Value: Sendable>: Sendable {
    case value(Value)
    case timedOut
}
