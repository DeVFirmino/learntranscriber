import Foundation
import SpeechCore
import Testing

/// The one-shot replies keep the exact JSON the desktop app reads.
struct SpeechReplyTests {
    private func json(_ reply: SpeechReply) throws -> String {
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.sortedKeys]
        return String(decoding: try encoder.encode(reply), as: UTF8.self)
    }

    @Test func capabilities() throws {
        let reply = SpeechReply.capabilities(CapabilitiesResponse(
            locale: "en-US", authorization: "authorized", supportsOnDeviceRecognition: true,
            supportsStreamingRecognition: false, locales: ["en-US"], engine: .speechTranscriber))
        #expect(try json(reply) == #"{"authorization":"authorized","engine":"SpeechTranscriber","locale":"en-US","locales":["en-US"],"supportsOnDeviceRecognition":true,"supportsStreamingRecognition":false}"#)
    }

    @Test func assetReplies() throws {
        #expect(try json(.assetList(AssetListResponse(locales: ["en_US"], installedLocales: [], reservedLocales: ["en_US"], maximumReservedLocales: 5)))
            == #"{"assetManagementAvailable":true,"installedLocales":[],"locales":["en_US"],"maximumReservedLocales":5,"reservedLocales":["en_US"]}"#)
        #expect(try json(.assetInstall(AssetInstallResponse(locale: "pt_BR")))
            == #"{"assetManagementAvailable":true,"assetStatus":"installed","locale":"pt_BR"}"#)
        #expect(try json(.assetRelease(AssetReleaseResponse(locale: "pt_BR", released: true)))
            == #"{"assetManagementAvailable":true,"locale":"pt_BR","released":true}"#)
        #expect(try json(.assetManagementUnavailable) == #"{"assetManagementAvailable":false}"#)
    }

    @Test func transcriptAndError() throws {
        #expect(try json(.transcript(TranscriptResponse(text: "oi", locale: "pt-BR"))) == #"{"locale":"pt-BR","text":"oi"}"#)
        #expect(try json(.failure(ErrorResponse(error: SpeechFailure.invalidArguments.localizedDescription)))
            == #"{"error":"Supply --capabilities or --audio <file> and --locale <locale>."}"#)
    }
}
