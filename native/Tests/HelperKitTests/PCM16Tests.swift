import Foundation
import Testing
@testable import HelperKit

struct PCM16Tests {
    @Test func clampsAndEncodesLittleEndian() {
        let data = PCM16.encode([0, 1, -1, 2, -2, .nan, 0.5])
        #expect(data.count == 14)
        let values = (0..<7).map { index in
            Int16(littleEndian: data.withUnsafeBytes { bytes in bytes.load(fromByteOffset: index * 2, as: Int16.self) })
        }
        #expect(values == [0, 32767, -32768, 32767, -32768, 0, 16383])
    }

    /// Encoding truncates positives at 32,767 steps and decoding divides by 32,768, as the original helpers did,
    /// so a round trip can drift by up to two steps.
    @Test func decodeRoundTripsWithinTwoSteps() {
        let original: [Float] = [0, 0.25, -0.5, 0.999]
        let decoded = PCM16.decode(PCM16.encode(original))
        for (a, b) in zip(original, decoded) { #expect(abs(a - b) <= 2.0 / 32_768) }
    }
}
