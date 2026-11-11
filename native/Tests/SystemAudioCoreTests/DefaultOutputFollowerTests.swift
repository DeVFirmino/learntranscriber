import Testing
@testable import SystemAudioCore

struct DefaultOutputFollowerTests {
    @Test func movesOnlyToANewAvailableOutput() {
        var follower = DefaultOutputFollower(current: "built-in")
        #expect(follower.follow("built-in") == nil, "the output in use is not a change")
        #expect(follower.follow(nil) == nil, "no default output keeps the current one")
        #expect(follower.follow("") == nil)
        #expect(follower.follow("usb-1") == "usb-1")
        #expect(follower.current == "usb-1")
        #expect(follower.follow("usb-1") == nil)
        #expect(follower.follow("built-in") == "built-in")
    }
}
