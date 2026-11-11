import CommandKit
import Testing

struct ArgumentsTests {
    @Test func readsTheValueAfterAFlag() {
        #expect(["--mode", "x", "--locale", "pt-BR"].value(after: "--locale") == "pt-BR")
        #expect(["--locale"].value(after: "--locale") == nil)
    }

    @Test func keepsTheFirstValueOfRepeatedOptions() {
        let arguments = ["--capabilities", "--locale", "en-US", "--locale", "pt-BR", "--flag"]
        #expect(arguments.keepingFirstOccurrence(of: ["--locale"]) == ["--capabilities", "--locale", "en-US", "--flag"])
        #expect(["--locale"].keepingFirstOccurrence(of: ["--locale"]) == ["--locale"])
    }
}
