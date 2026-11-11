/// Decides when the process tap must move to a new default output during a native output stream. A missing device
/// or the device already in use is not a change.
public struct DefaultOutputFollower: Sendable, Equatable {
    /// The UID of the output the tap is on.
    public private(set) var current: String

    /// Starts following from the output `current`.
    public init(current: String) {
        self.current = current
    }

    /// Records the reported default output `uid` and returns it when the tap must move there: an available device
    /// other than the current one. Returns `nil` otherwise.
    public mutating func follow(_ uid: String?) -> String? {
        guard let uid, uid.isEmpty == false, uid != current else { return nil }
        current = uid
        return uid
    }
}
