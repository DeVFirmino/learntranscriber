import Foundation

/// The `devices` line of the helper protocol: output devices, the default one first, then by name.
public struct OutputDeviceList: Encodable, Equatable, Sendable {
    /// The protocol event name of this line.
    public let event = "devices"
    /// The output devices, the default first and the rest in Finder name order.
    public var devices: [OutputDevice]
    /// The default output's UID, or `nil` when the system reports none (no output device connected).
    public var defaultOutputUID: String?

    /// Keeps the devices that can play sound and have a UID, and marks the default output when it is one of them.
    public init(devices all: [AudioDeviceInfo], defaultOutputUID: String?) {
        let outputs = all.filter { $0.outputChannels > 0 && $0.uid.isEmpty == false }
        let known = outputs.contains { $0.uid == defaultOutputUID }
        self.defaultOutputUID = known ? defaultOutputUID : nil
        devices = outputs
            .map { OutputDevice(uid: $0.uid, name: $0.name.isEmpty ? $0.uid : $0.name, isDefault: known && $0.uid == defaultOutputUID, hasInput: $0.inputChannels > 0) }
            .sorted { lhs, rhs in
                if lhs.isDefault != rhs.isDefault { return lhs.isDefault }
                return lhs.name.localizedStandardCompare(rhs.name) == .orderedAscending
            }
    }
}
