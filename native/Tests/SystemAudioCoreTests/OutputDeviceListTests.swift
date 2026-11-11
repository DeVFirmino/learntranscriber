import Foundation
import Testing
@testable import SystemAudioCore

struct OutputDeviceListTests {
    @Test func listsOnlyOutputsWithTheDefaultFirst() {
        let list = OutputDeviceList(
            devices: [
                AudioDeviceInfo(uid: "mic", name: "MacBook Microphone", outputChannels: 0, inputChannels: 1),
                AudioDeviceInfo(uid: "speakers", name: "MacBook Speakers", outputChannels: 2, inputChannels: 0),
                AudioDeviceInfo(uid: "loop", name: "BlackHole 2ch", outputChannels: 2, inputChannels: 2),
                AudioDeviceInfo(uid: "", name: "Nameless", outputChannels: 2, inputChannels: 0),
            ],
            defaultOutputUID: "speakers")
        #expect(list.defaultOutputUID == "speakers")
        #expect(list.devices.map(\.uid) == ["speakers", "loop"])
        #expect(list.devices[0].isDefault)
        #expect(list.devices[1].isDefault == false)
        #expect(list.devices[1].hasInput, "a loopback device can also record")
    }

    @Test func ordersTheOtherOutputsByNameAsFinderDoes() {
        let list = OutputDeviceList(
            devices: [
                AudioDeviceInfo(uid: "z", name: "Zeta", outputChannels: 2, inputChannels: 0),
                AudioDeviceInfo(uid: "s10", name: "Speaker 10", outputChannels: 2, inputChannels: 0),
                AudioDeviceInfo(uid: "a", name: "alpha", outputChannels: 2, inputChannels: 0),
                AudioDeviceInfo(uid: "s2", name: "Speaker 2", outputChannels: 2, inputChannels: 0),
            ],
            defaultOutputUID: "z")
        #expect(list.devices.map(\.name) == ["Zeta", "alpha", "Speaker 2", "Speaker 10"])
    }

    @Test func anUnknownDefaultIsNotReported() {
        let list = OutputDeviceList(
            devices: [AudioDeviceInfo(uid: "speakers", name: "", outputChannels: 2, inputChannels: 0)],
            defaultOutputUID: "gone")
        #expect(list.defaultOutputUID == nil)
        #expect(list.devices == [OutputDevice(uid: "speakers", name: "speakers", isDefault: false, hasInput: false)])
    }

    @Test func encodesTheDevicesLine() throws {
        let list = OutputDeviceList(
            devices: [AudioDeviceInfo(uid: "speakers", name: "Speakers", outputChannels: 2, inputChannels: 0)],
            defaultOutputUID: "speakers")
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.sortedKeys]
        #expect(String(decoding: try encoder.encode(list), as: UTF8.self)
            == #"{"defaultOutputUID":"speakers","devices":[{"hasInput":false,"isDefault":true,"name":"Speakers","uid":"speakers"}],"event":"devices"}"#)
    }
}
