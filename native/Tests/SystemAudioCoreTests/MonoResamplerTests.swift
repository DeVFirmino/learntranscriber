import Testing
@testable import SystemAudioCore

struct MonoResamplerTests {
    /// One resampling scenario: input at `sourceRate` with `channels` interleaved, and the exact mono output.
    struct Case: Sendable, CustomTestStringConvertible {
        let name: String
        let sourceRate: Double
        let channels: Int
        let input: [Float]
        let output: [Float]

        var testDescription: String { name }
    }

    private func resample(_ resampler: inout MonoResampler, _ samples: [Float], channels: Int) -> [Float] {
        samples.withUnsafeBufferPointer { resampler.resample(interleaved: $0, channels: channels) }
    }

    @Test(arguments: [
        Case(name: "the helper rate passes through", sourceRate: 16_000, channels: 1, input: [0.25, -0.5, 1], output: [0.25, -0.5, 1]),
        Case(name: "a zero rate is the helper rate", sourceRate: 0, channels: 1, input: [0.25, -0.5, 1], output: [0.25, -0.5, 1]),
        Case(name: "a negative rate is the helper rate", sourceRate: -48_000, channels: 1, input: [0.25, -0.5], output: [0.25, -0.5]),
        Case(name: "upsampling interpolates", sourceRate: 8_000, channels: 1, input: [0, 1], output: [0, 0.5, 1]),
        Case(name: "downsampling skips", sourceRate: 32_000, channels: 1, input: [0, 1, 2, 3], output: [0, 2]),
        Case(name: "a trailing partial frame is ignored", sourceRate: 16_000, channels: 2, input: [1, 0, 0.5, 0.5, 1], output: [0.5, 0.5]),
        Case(name: "no whole frame gives nothing", sourceRate: 16_000, channels: 2, input: [1], output: []),
    ])
    func resamplesInterleavedInput(_ scenario: Case) {
        var resampler = MonoResampler(sourceRate: scenario.sourceRate)
        #expect(resample(&resampler, scenario.input, channels: scenario.channels) == scenario.output)
    }

    @Test func averagesChannelsAndKeepsAConstantLevel() {
        var resampler = MonoResampler(sourceRate: 48_000)
        let stereo: [Float] = (0..<960).map { $0 % 2 == 0 ? 1 : 0 }
        let output = resample(&resampler, stereo, channels: 2)
        #expect(output.count == 160, "480 frames at 48 kHz are 160 samples at 16 kHz")
        #expect(output.dropFirst().allSatisfy { abs($0 - 0.5) < 0.0001 })
    }

    @Test func splittingTheInputDoesNotChangeTheOutput() {
        let ramp = (0..<4_410).map { Float($0) / 4_410 }
        var whole = MonoResampler(sourceRate: 44_100)
        let single = resample(&whole, ramp, channels: 1)
        var parts = MonoResampler(sourceRate: 44_100)
        var split: [Float] = []
        for chunk in stride(from: 0, to: ramp.count, by: 512) {
            split += resample(&parts, Array(ramp[chunk..<min(chunk + 512, ramp.count)]), channels: 1)
        }
        #expect(split.count == single.count)
        #expect(zip(split, single).allSatisfy { abs($0 - $1) < 0.00001 })
    }

    @Test func aSinglePlanarBufferIsResampledAsInterleaved() {
        var resampler = MonoResampler(sourceRate: 16_000)
        #expect(resampler.resample(planar: [SampleBuffer(samples: [1, 0, 0.5, 0.5], channels: 2)]) == [0.5, 0.5])
    }

    @Test func planarBuffersAreAveragedOverTheFramesTheyShare() {
        var resampler = MonoResampler(sourceRate: 16_000)
        let left = SampleBuffer(samples: [1, 1, 1], channels: 1)
        let right = SampleBuffer(samples: [0, 0.5], channels: 1)
        #expect(resampler.resample(planar: [left, right]) == [0.5, 0.75])
    }

    @Test func planarMixingTakesTheFirstChannelOfEachBuffer() {
        var resampler = MonoResampler(sourceRate: 16_000)
        let first = SampleBuffer(samples: [1, 9, 1, 9], channels: 2)
        let second = SampleBuffer(samples: [0, 0], channels: 1)
        #expect(resampler.resample(planar: [first, second]) == [0.5, 0.5])
    }

    @Test func emptyAndChannellessBuffersAreSkipped() {
        var resampler = MonoResampler(sourceRate: 16_000)
        #expect(resampler.resample(planar: []) == [])
        let skipped = [SampleBuffer(samples: [], channels: 1), SampleBuffer(samples: [1, 1], channels: 0)]
        #expect(resampler.resample(planar: skipped) == [])
        #expect(resampler.resample(planar: skipped + [SampleBuffer(samples: [0.25], channels: 1)]) == [0.25])
    }
}
