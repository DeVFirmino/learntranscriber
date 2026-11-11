import Foundation
import SpeechCore
import Testing

struct SessionIdentityTests {
    @Test func keepsTheRequestedLanguage() throws {
        let identity = try SessionIdentity(sessionId: "s1", speakerLabel: "THEY", language: "pt-BR")
        #expect(identity.speaker == .they)
        #expect(identity.locale == "pt-BR")
    }

    @Test(arguments: [nil, "auto"])
    func autoOrNoLanguageResolvesToTheDefaultLocale(language: String?) throws {
        let identity = try SessionIdentity(sessionId: "s1", speakerLabel: "ME", language: language, defaultLocale: "de-DE")
        #expect(identity.locale == "de-DE")
    }

    @Test(arguments: [
        ("s1", "HIM"),
        ("s1", "me"),
        (String(repeating: "x", count: 101), "ME"),
    ])
    func refusesAnUnknownSpeakerOrAnOverlongSessionId(sessionId: String, speakerLabel: String) {
        #expect(throws: SpeechFailure.invalidArguments) {
            try SessionIdentity(sessionId: sessionId, speakerLabel: speakerLabel, language: nil)
        }
    }

    @Test func refusesAMissingSessionIdOrSpeaker() {
        #expect(throws: SpeechFailure.invalidArguments) { try SessionIdentity(sessionId: nil, speakerLabel: "ME", language: nil) }
        #expect(throws: SpeechFailure.invalidArguments) { try SessionIdentity(sessionId: "s1", speakerLabel: nil, language: nil) }
    }

    @Test func eventsCarryTheResolvedLocaleExceptErrors() throws {
        let identity = try SessionIdentity(sessionId: "s1", speakerLabel: "THEY", language: "pt-BR")
        #expect(identity.makeEvent(.partial, text: "oi")
            == SessionEvent(kind: .partial, sessionId: "s1", speakerLabel: "THEY", text: "oi", resolvedLocale: "pt-BR"))
        #expect(identity.makeEvent(.error, error: "x").resolvedLocale == nil)
    }
}

struct SessionEventTests {
    private func json(_ event: SessionEvent) throws -> String {
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.sortedKeys]
        return String(decoding: try encoder.encode(event), as: UTF8.self)
    }

    @Test func encodesTheKindAsTypeAndLeavesOutAbsentFields() throws {
        let identity = try SessionIdentity(sessionId: "s1", speakerLabel: "ME", language: "en-US")
        #expect(try json(identity.makeEvent(.ready, assetStatus: "available"))
            == #"{"assetStatus":"available","resolvedLocale":"en-US","sessionId":"s1","speakerLabel":"ME","type":"ready"}"#)
        #expect(try json(identity.makeEvent(.final, text: ""))
            == #"{"resolvedLocale":"en-US","sessionId":"s1","speakerLabel":"ME","text":"","type":"final"}"#)
    }
}

struct LocaleMatchingTests {
    @Test func identifiersMatchAcrossSeparatorsAndCase() {
        #expect(LocaleMatching.areEquivalent("en_US", "en-us"))
        #expect(LocaleMatching.areEquivalent("en_US", "en-GB") == false)
    }
}
