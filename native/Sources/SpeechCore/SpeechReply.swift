/// The single JSON line a one-shot run answers with. Each case encodes exactly its own reply's fields.
public enum SpeechReply: Encodable, Equatable, Sendable {
    /// What this Mac can recognize for a locale.
    case capabilities(CapabilitiesResponse)
    /// The supported, installed and reserved languages.
    case assetList(AssetListResponse)
    /// A language that is now reserved and installed.
    case assetInstall(AssetInstallResponse)
    /// A language reservation the app released.
    case assetRelease(AssetReleaseResponse)
    /// Language management needs the macOS 26 speech stack, which this Mac lacks: `{"assetManagementAvailable":false}`.
    case assetManagementUnavailable
    /// The text of a transcribed file.
    case transcript(TranscriptResponse)
    /// Why the run failed.
    case failure(ErrorResponse)

    public func encode(to encoder: any Encoder) throws {
        switch self {
        case .capabilities(let reply): try reply.encode(to: encoder)
        case .assetList(let reply): try reply.encode(to: encoder)
        case .assetInstall(let reply): try reply.encode(to: encoder)
        case .assetRelease(let reply): try reply.encode(to: encoder)
        case .assetManagementUnavailable:
            var container = encoder.container(keyedBy: UnavailableKeys.self)
            try container.encode(false, forKey: .assetManagementAvailable)
        case .transcript(let reply): try reply.encode(to: encoder)
        case .failure(let reply): try reply.encode(to: encoder)
        }
    }

    private enum UnavailableKeys: String, CodingKey {
        case assetManagementAvailable
    }
}
