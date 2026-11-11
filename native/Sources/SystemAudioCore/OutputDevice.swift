/// An output device the app can show: where the system plays sound.
public struct OutputDevice: Encodable, Equatable, Sendable {
    /// Core Audio's persistent identifier for the device.
    public var uid: String
    /// The name to show; the UID when the system reports no name.
    public var name: String
    /// Whether the system currently plays sound on this device.
    public var isDefault: Bool
    /// The device can also record, as virtual loopback devices do.
    public var hasInput: Bool
}
