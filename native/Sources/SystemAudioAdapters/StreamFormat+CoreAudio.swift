import CoreAudio
import SystemAudioCore

extension StreamFormat {
    /// Creates the format Core Audio describes in `description`.
    public init(_ description: AudioStreamBasicDescription) {
        self.init(
            sampleRate: description.mSampleRate,
            channelCount: Int(description.mChannelsPerFrame),
            bitsPerChannel: Int(description.mBitsPerChannel),
            isFloat: description.mFormatFlags & kAudioFormatFlagIsFloat != 0)
    }
}
