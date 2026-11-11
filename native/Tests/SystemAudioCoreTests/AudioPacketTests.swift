import Foundation
import Testing
@testable import SystemAudioCore

struct AudioPacketTests {
    @Test(arguments: [
        (AudioPacket.started, #"{"event":"started"}"#),
        (.stopped, #"{"event":"stopped"}"#),
        (.audio(Data([0, 1])), #"{"event":"audio","samples":"AAE="}"#),
        (.failure("No connected display is available."), #"{"error":"No connected display is available.","event":"error"}"#),
        (.status(supported: true, permissionGranted: false), #"{"event":"status","permissionGranted":false,"supported":true}"#),
        (
            .status(supported: true, permissionGranted: true, processTapSupported: false),
            #"{"event":"status","permissionGranted":true,"processTapSupported":false,"supported":true}"#
        ),
        (.reconnecting("default output changed"), #"{"event":"reconnecting","reason":"default output changed"}"#),
        (.deviceChanged(id: "usb-1", name: "Desk Speakers"), #"{"deviceId":"usb-1","deviceName":"Desk Speakers","event":"device-changed"}"#),
    ])
    func encodesTheProtocolLine(packet: AudioPacket, json: String) throws {
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.sortedKeys]
        #expect(String(decoding: try encoder.encode(packet), as: UTF8.self) == json)
    }
}
