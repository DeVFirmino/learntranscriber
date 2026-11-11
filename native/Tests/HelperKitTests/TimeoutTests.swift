import Testing
@testable import HelperKit

struct TimeoutTests {
    private actor Stopped {
        var value = false
        func mark() { value = true }
    }

    @Test func returnsTheValueWhenFast() async throws {
        let value = try await withTimeout(.seconds(1), failure: HelperError("late")) { 42 }
        #expect(value == 42)
    }

    @Test func failsWithTheGivenErrorWhenSlow() async {
        await #expect(throws: HelperError("late")) {
            try await withTimeout(.milliseconds(20), failure: HelperError("late")) {
                try await Task.sleep(for: .seconds(5))
                return 0
            }
        }
    }

    @Test func cancelsTheOperationThatLoses() async {
        await confirmation("the losing operation observes cancellation") { cancelled in
            _ = await #expect(throws: HelperError("late")) {
                try await withTimeout(.milliseconds(20), failure: HelperError("late")) {
                    do { try await Task.sleep(for: .seconds(5)) }
                    catch is CancellationError { cancelled() }
                    return 0
                }
            }
        }
    }

    @Test func theOperationsOwnErrorWinsOverTheTimeoutFailure() async {
        await #expect(throws: HelperError("broken")) {
            try await withTimeout(.seconds(1), failure: HelperError("late")) { () throws -> Int in throw HelperError("broken") }
        }
    }

    @Test func runsTheHookBeforeFailingOnTimeout() async {
        let stopped = Stopped()
        await #expect(throws: HelperError("late")) {
            try await withTimeout(.milliseconds(20), failure: HelperError("late"), onTimeout: { await stopped.mark() }) {
                try await Task.sleep(for: .seconds(5))
                return 0
            }
        }
        #expect(await stopped.value)
    }

    @Test func skipsTheHookWhenTheOperationWins() async throws {
        let stopped = Stopped()
        _ = try await withTimeout(.seconds(1), failure: HelperError("late"), onTimeout: { await stopped.mark() }) { 1 }
        #expect(await stopped.value == false)
    }
}
