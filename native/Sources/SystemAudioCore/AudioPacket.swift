import Foundation

/// One line of the protocol the desktop app reads from the system-audio helper.
public struct AudioPacket: Encodable, Equatable, Sendable {
    /// Which line this is.
    public let event: Event
    /// PCM16 audio, base64-encoded, on `audio` lines.
    public let samples: String?
    /// The message to show, on `error` lines.
    public let error: String?
    /// Whether this Mac can capture system audio, on `status` lines.
    public let supported: Bool?
    /// Whether Screen & System Audio Recording is granted, on `status` lines.
    public let permissionGranted: Bool?
    /// Whether this Mac can use the Core Audio process tap source (macOS 14.2 or later).
    public let processTapSupported: Bool?
    /// The output the tap follows after a default output change, reported by the `device-changed` event.
    public let deviceId: String?
    /// The name of that output.
    public let deviceName: String?
    /// Why the stream is being rebuilt, reported by the `reconnecting` event.
    public let reason: String?

    /// Creates a line with `event` and whichever fields it carries; fields left `nil` are not written.
    public init(
        event: Event, samples: String? = nil, error: String? = nil, supported: Bool? = nil, permissionGranted: Bool? = nil,
        processTapSupported: Bool? = nil, deviceId: String? = nil, deviceName: String? = nil, reason: String? = nil
    ) {
        self.event = event
        self.samples = samples
        self.error = error
        self.supported = supported
        self.permissionGranted = permissionGranted
        self.processTapSupported = processTapSupported
        self.deviceId = deviceId
        self.deviceName = deviceName
        self.reason = reason
    }

    /// Capture is running; audio lines follow.
    public static let started = AudioPacket(event: .started)
    /// Capture has ended; nothing follows.
    public static let stopped = AudioPacket(event: .stopped)

    /// A packet carrying PCM16 audio, base64-encoded.
    public static func audio(_ pcm: Data) -> AudioPacket { AudioPacket(event: .audio, samples: pcm.base64EncodedString()) }

    /// The answer to `--status`.
    ///
    /// `permissionGranted` reflects the Screen & System Audio Recording grant ScreenCaptureKit needs. It says
    /// nothing about the process tap, whose System Audio Recording grant macOS cannot check without capturing.
    public static func status(supported: Bool, permissionGranted: Bool, processTapSupported: Bool? = nil) -> AudioPacket {
        AudioPacket(event: .status, supported: supported, permissionGranted: permissionGranted, processTapSupported: processTapSupported)
    }

    /// A failure the app shows as `message`.
    public static func failure(_ message: String) -> AudioPacket { AudioPacket(event: .error, error: message) }

    /// The stream is being rebuilt because of `reason`.
    public static func reconnecting(_ reason: String) -> AudioPacket { AudioPacket(event: .reconnecting, reason: reason) }

    /// The tap now follows the output `id`, named `name`.
    public static func deviceChanged(id: String, name: String) -> AudioPacket {
        AudioPacket(event: .deviceChanged, deviceId: id, deviceName: name)
    }
}
