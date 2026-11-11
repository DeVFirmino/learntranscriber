extension AudioPacket {
    /// The protocol event names; the raw value is what the app reads.
    public enum Event: String, Encodable, Sendable {
        case started
        case stopped
        case audio
        case status
        case error
        case reconnecting
        case deviceChanged = "device-changed"
    }
}
