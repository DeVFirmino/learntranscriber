import ContextCore
import Foundation
import Vision

/// Apple Vision OCR with language correction and automatic language detection.
public struct VisionTextRecognizer: TextRecognizing {
    /// Creates a recognizer that runs Vision's accurate text recognition.
    public init() {}

    /// The text in the image file at `url`. Files above `ContextBounds.maximumImageBytes` are refused before decoding.
    public func text(inImageAt url: URL) throws -> String {
        try ContextBounds.checkImage(bytes: url.resourceValues(forKeys: [.fileSizeKey]).fileSize ?? 0)
        return try recognize(VNImageRequestHandler(url: url, options: [:]))
    }

    /// The text in `image`, recognized the same way as an image file.
    public func text(in image: CGImage) throws -> String { try recognize(VNImageRequestHandler(cgImage: image)) }

    private func recognize(_ handler: VNImageRequestHandler) throws -> String {
        let request = VNRecognizeTextRequest()
        request.recognitionLevel = .accurate
        request.usesLanguageCorrection = true
        request.automaticallyDetectsLanguage = true
        try handler.perform([request])
        return ContextBounds.clippedText(joining: (request.results ?? []).compactMap { $0.topCandidates(1).first?.string })
    }
}
