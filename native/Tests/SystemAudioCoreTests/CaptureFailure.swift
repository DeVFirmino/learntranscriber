import Foundation

/// A capture error with the message an adapter would give.
struct CaptureFailure: LocalizedError, Equatable {
    let message: String

    var errorDescription: String? { message }
}
