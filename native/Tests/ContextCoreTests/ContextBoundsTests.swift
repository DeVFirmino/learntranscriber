import Testing
import HelperKit
@testable import ContextCore

struct ContextBoundsTests {
    @Test func clipsTextTo20000Characters() {
        #expect(ContextBounds.clip(String(repeating: "a", count: 25_000)).count == 20_000)
        #expect(ContextBounds.clip("short") == "short")
    }

    @Test func joinsRecognizedLinesWithNewlines() {
        #expect(ContextBounds.clippedText(joining: ["one", "two"]) == "one\ntwo")
        #expect(ContextBounds.clippedText(joining: []) == "")
    }

    @Test func clipsTheJoinedText() {
        let lines = Array(repeating: String(repeating: "a", count: 9_999), count: 3)
        #expect(ContextBounds.clippedText(joining: lines).count == 20_000)
    }

    @Test func refusesImagesOver20MB() {
        #expect(throws: HelperError("Image exceeds the 20 MB OCR limit.")) { try ContextBounds.checkImage(bytes: 20_000_001) }
        #expect(throws: Never.self) { try ContextBounds.checkImage(bytes: 20_000_000) }
    }
}
