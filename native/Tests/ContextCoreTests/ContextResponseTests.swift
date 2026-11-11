import Foundation
import Testing
@testable import ContextCore

struct ContextResponseTests {
    @Test func encodesOnlyPresentFields() throws {
        let data = try JSONEncoder().encode(ContextResponse(trusted: true))
        #expect(String(decoding: data, as: UTF8.self) == #"{"trusted":true}"#)
    }
}
