import Foundation
import HelperKit
import SpeechAdapters
import SpeechCore
import Testing
@testable import apple_speech

@MainActor
struct SpeechHelperTests {
    @Test(arguments: [
        (["--capabilities", "--audio", "/a.wav", "--list-assets"], SpeechHelper.Request.assets(.list)),
        (["--list-assets", "--install-locale"], .assets(.install)),
        (["--install-locale", "--release-locale"], .assets(.release)),
        (["--audio", "/a.wav", "--capabilities"], .capabilities),
        (["--audio", "/a.wav"], .transcribe(audio: "/a.wav")),
    ])
    func languageManagementWinsOverCapabilitiesWhichWinOverAudio(arguments: [String], request: SpeechHelper.Request) throws {
        #expect(try SpeechHelper.parse(arguments).request == request)
    }

    @Test func noRequestIsTheUsageError() throws {
        let command = try SpeechHelper.parse([])
        #expect(throws: SpeechFailure.invalidArguments) { try command.request }
    }

    @Test func sessionIsTheOnlyMode() throws {
        #expect(try SpeechHelper.parse(["--mode", "session"]).mode == .session)
        #expect(throws: (any Error).self) { try SpeechHelper.parse(["--mode", "Session"]) }
    }

    @Test func languageManagementWithoutTheModernStackSaysSo() async throws {
        let command = try SpeechHelper.parse(["--install-locale", "--locale", "pt-BR"])
        #expect(try await command.respond(services: FakeServices(hasAssets: false)) == .assetManagementUnavailable)
    }

    @Test func languageOperationsGetTheRequestedLocale() async throws {
        let services = FakeServices()
        #expect(try await SpeechHelper.parse(["--install-locale", "--locale", "pt-BR"]).respond(services: services)
            == .assetInstall(AssetInstallResponse(locale: "pt-BR")))
        #expect(try await SpeechHelper.parse(["--release-locale", "--locale", "pt-BR"]).respond(services: services)
            == .assetRelease(AssetReleaseResponse(locale: "pt-BR", released: true)))
    }

    @Test func aMissingAudioFileIsTheUsageErrorAndAsksNoPermission() async throws {
        let services = FakeServices()
        let command = try SpeechHelper.parse(["--audio", "/nonexistent.wav", "--locale", "en-US"])
        await #expect(throws: SpeechFailure.invalidArguments) { try await command.respond(services: services) }
        #expect(services.authorizations == 0)
    }

    @Test func anExistingFileIsTranscribedAfterAuthorization() async throws {
        let services = FakeServices()
        let command = try SpeechHelper.parse(["--audio", #filePath, "--locale", "pt-BR"])
        #expect(try await command.respond(services: services)
            == .transcript(TranscriptResponse(text: "pt-BR SpeechHelperTests.swift", locale: "pt-BR")))
        #expect(services.authorizations == 1)
    }

    @Test func aDeniedPermissionStopsTranscription() async throws {
        let services = FakeServices(authorization: .permissionDenied)
        let command = try SpeechHelper.parse(["--audio", #filePath])
        await #expect(throws: SpeechFailure.permissionDenied) { try await command.respond(services: services) }
    }

    @Test func aSessionStreamsChunksReportsGapsAndStopsAtTheEnd() async throws {
        let services = FakeServices()
        try await runSession(services: services, chunks: [.bytes(Data([1, 2, 3])), .idle, .bytes(Data([4])), .end])
        #expect(services.live.calls == [.ready, .append(Data([1, 2])), .paused, .append(Data([3, 4])), .stop])
    }

    @Test func aStreamEndingMidSampleIsMalformedAudio() async throws {
        let services = FakeServices()
        await #expect(throws: SpeechFailure.malformedAudio) {
            try await runSession(services: services, chunks: [.bytes(Data([1, 2, 3])), .end])
        }
        #expect(services.live.calls == [.ready, .append(Data([1, 2])), .stop], "the recognizer still drains")
    }

    @Test func anInvalidSessionIsRefusedBeforeAskingPermission() async throws {
        let services = FakeServices()
        let command = try SpeechHelper.parse(["--mode", "session", "--session-id", "s1", "--speaker-label", "HIM"])
        await #expect(throws: SpeechFailure.invalidArguments) {
            try await command.runSession(services: services, sink: NoSink()) { .end }
        }
        #expect(services.authorizations == 0)
        #expect(services.live.calls.isEmpty)
    }

    @Test func sessionErrorsEchoTheIdsAndCarryNoLocale() throws {
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.sortedKeys]
        let missing = SpeechHelper.sessionError(SpeechHelper.usage, sessionId: nil, speakerLabel: nil)
        #expect(String(decoding: try encoder.encode(missing), as: UTF8.self)
            == #"{"error":"Supply --capabilities or --audio <file> and --locale <locale>.","sessionId":"","speakerLabel":"","type":"error"}"#)
        let given = SpeechHelper.sessionError("Failed", sessionId: "s1", speakerLabel: "ME")
        #expect(given == SessionEvent(kind: .error, sessionId: "s1", speakerLabel: "ME", error: "Failed"))
    }

    private func runSession(services: FakeServices, chunks: [StandardInputReader.Chunk]) async throws {
        var remaining = chunks
        let command = try SpeechHelper.parse(["--mode", "session", "--session-id", "s1", "--speaker-label", "ME", "--language", "pt-BR"])
        try await command.runSession(services: services, sink: NoSink()) { remaining.removeFirst() }
    }
}

private struct NoSink: SessionEventSink {
    func emit(_ event: SessionEvent) {}
}

private final class FakeServices: SpeechServices {
    let hasAssets: Bool
    let authorization: SpeechFailure?
    let live = FakeLiveRecognizer()
    private(set) var authorizations = 0

    init(hasAssets: Bool = true, authorization: SpeechFailure? = nil) {
        self.hasAssets = hasAssets
        self.authorization = authorization
    }

    func languageAssets() -> (any LanguageAssetManaging)? { hasAssets ? FakeAssets() : nil }

    func capabilities(locale: String) async -> CapabilitiesResponse {
        CapabilitiesResponse(locale: locale, authorization: "authorized", supportsOnDeviceRecognition: true,
                             supportsStreamingRecognition: true, locales: [locale], engine: .sfSpeechRecognizer)
    }

    func authorize() async throws {
        authorizations += 1
        if let authorization { throw authorization }
    }

    func fileRecognizer(locale: String) async -> any FileRecognizing { FakeFileRecognizer(locale: locale) }

    func liveRecognizer(identity: SessionIdentity, sink: any SessionEventSink) throws -> any LiveRecognizing { live }
}

private struct FakeAssets: LanguageAssetManaging {
    func list() async -> AssetListResponse {
        AssetListResponse(locales: [], installedLocales: [], reservedLocales: [], maximumReservedLocales: 0)
    }
    func install(locale: String) async throws -> AssetInstallResponse { AssetInstallResponse(locale: locale) }
    func release(locale: String) async throws -> AssetReleaseResponse { AssetReleaseResponse(locale: locale, released: true) }
}

private struct FakeFileRecognizer: FileRecognizing {
    let locale: String
    func transcribe(fileAt url: URL) async throws -> String { "\(locale) \(url.lastPathComponent)" }
}

private final class FakeLiveRecognizer: LiveRecognizing {
    enum Call: Equatable {
        case ready
        case append(Data)
        case paused
        case stop
    }

    private(set) var calls: [Call] = []

    func announceReady() { calls.append(.ready) }
    func append(_ data: Data) async throws { calls.append(.append(data)) }
    func inputPaused() async { calls.append(.paused) }
    func stop() async { calls.append(.stop) }
}
