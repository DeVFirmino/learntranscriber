import ArgumentParser
import ContextAdapters
import ContextCore
import CoreGraphics
import Foundation
import HelperKit
import Testing
@testable import context_helper

@MainActor
struct ContextHelperTests {
    private struct FakeReader: SelectionReading {
        var isTrusted = true
        var found: Selection?
        var failure: HelperError?
        func selection(excludingProcess excludedProcess: pid_t?) throws -> Selection? {
            if let failure { throw failure }
            return found
        }
    }

    /// Answers with the process it was told to exclude, so forwarding can be observed.
    private struct ExcludedProcessEcho: SelectionReading {
        var isTrusted: Bool { true }
        func selection(excludingProcess excludedProcess: pid_t?) throws -> Selection? {
            Selection(text: excludedProcess.map(String.init) ?? "none")
        }
    }

    private struct FakeRecognizer: TextRecognizing {
        var text = "recognized"
        func text(inImageAt url: URL) throws -> String { "\(text) \(url.lastPathComponent)" }
        func text(in image: CGImage) throws -> String { "\(text) \(image.width)x\(image.height)" }
    }

    private func unusedImage() throws -> CGImage { throw HelperError("unused") }

    /// A blank 2×1 bitmap, enough for the fake recognizer to show which image it was given.
    private func blankImage() throws -> CGImage {
        let context = try #require(CGContext(
            data: nil, width: 2, height: 1, bitsPerComponent: 8, bytesPerRow: 0,
            space: CGColorSpaceCreateDeviceGray(), bitmapInfo: CGImageAlphaInfo.none.rawValue))
        return try #require(context.makeImage())
    }

    @Test func reportsTrustThroughTheReader() throws {
        let command = try ContextHelper.parse(["--status"])
        #expect(try command.respond(selection: FakeReader(isTrusted: false), recognizer: FakeRecognizer(), selfTestImage: unusedImage)
            == ContextResponse(trusted: false))
    }

    @Test func aDeniedPermissionBecomesTheErrorItThrows() throws {
        let command = try ContextHelper.parse(["--selection"])
        let denied = FakeReader(failure: HelperError("Enable Accessibility"))
        #expect(throws: HelperError("Enable Accessibility")) {
            try command.respond(selection: denied, recognizer: FakeRecognizer(), selfTestImage: unusedImage)
        }
    }

    @Test func noSelectionIsAnEmptyText() throws {
        let command = try ContextHelper.parse(["--selection", "--exclude-pid", "42"])
        #expect(try command.respond(selection: FakeReader(), recognizer: FakeRecognizer(), selfTestImage: unusedImage)
            == ContextResponse(text: ""))
    }

    @Test func aSelectionCarriesItsApplication() throws {
        let command = try ContextHelper.parse(["--selection"])
        let reader = FakeReader(found: Selection(text: "picked", application: "Notes"))
        #expect(try command.respond(selection: reader, recognizer: FakeRecognizer(), selfTestImage: unusedImage)
            == ContextResponse(text: "picked", application: "Notes"))
    }

    @Test(arguments: [
        (["--selection", "--exclude-pid", "42"], "42"),
        (["--selection", "--exclude-pid", "bad"], "none"),
        (["--selection"], "none"),
    ])
    func forwardsTheExcludedProcessOnlyWhenItIsANumber(arguments: [String], forwarded: String) throws {
        let command = try ContextHelper.parse(arguments)
        #expect(try command.respond(selection: ExcludedProcessEcho(), recognizer: FakeRecognizer(), selfTestImage: unusedImage)
            == ContextResponse(text: forwarded))
    }

    @Test func imagesGoToTheRecognizer() throws {
        let command = try ContextHelper.parse(["--image", "/tmp/screen.png"])
        #expect(try command.respond(selection: FakeReader(), recognizer: FakeRecognizer(), selfTestImage: unusedImage)
            == ContextResponse(text: "recognized screen.png"))
    }

    @Test func theSelfTestRecognizesTheImageItIsGiven() throws {
        let command = try ContextHelper.parse(["--self-test"])
        #expect(try command.respond(selection: FakeReader(), recognizer: FakeRecognizer(), selfTestImage: blankImage)
            == ContextResponse(text: "recognized 2x1"))
    }

    /// The real drawing and the real Vision recognizer, as `--self-test` runs them; nothing leaves the device.
    @Test func theSelfTestReadsBackTheBuiltInSentence() throws {
        let command = try ContextHelper.parse(["--self-test"])
        #expect(try command.respond(selection: FakeReader(), recognizer: VisionTextRecognizer(), selfTestImage: SelfTestImage.render)
            == ContextResponse(text: ContextSelfTest.text))
    }

    @Test func noModeIsTheUsageError() throws {
        let error = try #require(throws: (any Error).self) { try ContextHelper.parse([]) }
        #expect(ContextHelper.exitCode(for: error) == .validationFailure)
        #expect(ContextHelper.message(for: error) == ContextHelper.usage)
    }

    /// Each of these reaches the one usage line through the same route: a validation failure while parsing.
    @Test(arguments: [[], ["--status", "--bogus"], ["--image"]])
    func usageMistakesFailValidation(arguments: [String]) throws {
        let error = try #require(throws: (any Error).self) { try ContextHelper.parse(arguments) }
        #expect(ContextHelper.exitCode(for: error) == .validationFailure)
    }
}
