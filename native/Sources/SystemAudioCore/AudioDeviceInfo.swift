/// One audio device as Core Audio reports it.
public struct AudioDeviceInfo: Equatable, Sendable {
    /// Core Audio's persistent identifier for the device.
    public var uid: String
    /// The name the system shows; may be empty.
    public var name: String
    /// Output channels summed over the device's output streams; zero for an input-only device.
    public var outputChannels: Int
    /// Input channels summed over the device's input streams.
    public var inputChannels: Int

    /// Creates a device description from the values Core Audio reported.
    public init(uid: String, name: String, outputChannels: Int, inputChannels: Int) {
        self.uid = uid
        self.name = name
        self.outputChannels = outputChannels
        self.inputChannels = inputChannels
    }
}
