// swift-tools-version: 6.2
import Foundation
import PackageDescription

// Command-line helpers need their own privacy metadata; the enclosing Electron app's plist is not sufficient.
let speechInfoPlist = URL(filePath: #filePath).deletingLastPathComponent()
    .appending(path: "Support/AppleSpeech-Info.plist").path(percentEncoded: false)

// Swift 6 language mode already checks concurrency strictly; every target also treats warnings as errors.
let warningsAsErrors: [SwiftSetting] = [.treatAllWarnings(as: .error)]

let argumentParser: Target.Dependency = .product(name: "ArgumentParser", package: "swift-argument-parser")

// Swift Testing ships with the toolchain; `swift test` runs the suites once Xcode is installed.
let package = Package(
    name: "LearnTranscriberNative",
    platforms: [.macOS(.v14)],
    dependencies: [
        .package(url: "https://github.com/apple/swift-argument-parser", from: "1.7.0"),
    ],
    targets: [
        // Shared by every helper: JSON line output, errors, timeouts, stdin chunks, PCM conversion. No ArgumentParser.
        .target(name: "HelperKit", swiftSettings: warningsAsErrors),
        .testTarget(name: "HelperKitTests", dependencies: ["HelperKit"], swiftSettings: warningsAsErrors),
        // Shared by the three commands only: the common command ending and the raw-argument rules.
        .target(name: "CommandKit", dependencies: ["HelperKit", argumentParser], swiftSettings: warningsAsErrors),
        .testTarget(name: "CommandKitTests", dependencies: ["CommandKit", "HelperKit", argumentParser], swiftSettings: warningsAsErrors),
        // The three helpers the desktop app launches. Product names match the files it expects.
        // Speech: protocol models and streaming rules, Apple Speech adapters for both engines, and the command.
        .target(name: "SpeechCore", swiftSettings: warningsAsErrors),
        .testTarget(name: "SpeechCoreTests", dependencies: ["SpeechCore"], swiftSettings: warningsAsErrors),
        .target(
            name: "SpeechAdapters", dependencies: ["HelperKit", "SpeechCore"], swiftSettings: warningsAsErrors,
            linkerSettings: [.linkedFramework("Speech"), .linkedFramework("AVFAudio")]),
        .testTarget(name: "SpeechAdaptersTests", dependencies: ["SpeechAdapters", "SpeechCore"], swiftSettings: warningsAsErrors),
        .executableTarget(
            name: "apple-speech",
            dependencies: ["HelperKit", "CommandKit", "SpeechCore", "SpeechAdapters", argumentParser],
            swiftSettings: warningsAsErrors,
            linkerSettings: [.unsafeFlags(["-Xlinker", "-sectcreate", "-Xlinker", "__TEXT", "-Xlinker", "__info_plist", "-Xlinker", speechInfoPlist])]),
        .testTarget(name: "AppleSpeechTests", dependencies: ["apple-speech", "SpeechAdapters", "SpeechCore", "HelperKit"], swiftSettings: warningsAsErrors),
        // System audio: pure packet rules; ScreenCaptureKit and Core Audio (process tap, device queries) adapters; and the command.
        .target(name: "SystemAudioCore", swiftSettings: warningsAsErrors),
        .testTarget(name: "SystemAudioCoreTests", dependencies: ["SystemAudioCore"], swiftSettings: warningsAsErrors),
        .target(
            name: "SystemAudioAdapters", dependencies: ["HelperKit", "SystemAudioCore"], swiftSettings: warningsAsErrors,
            linkerSettings: [.linkedFramework("ScreenCaptureKit"), .linkedFramework("CoreMedia"), .linkedFramework("CoreAudio")]),
        .testTarget(
            name: "SystemAudioAdaptersTests", dependencies: ["SystemAudioAdapters", "SystemAudioCore", "HelperKit"],
            swiftSettings: warningsAsErrors),
        .executableTarget(
            name: "system-audio",
            dependencies: ["HelperKit", "CommandKit", "SystemAudioCore", "SystemAudioAdapters", argumentParser],
            swiftSettings: warningsAsErrors, linkerSettings: [.linkedFramework("CoreGraphics")]),
        // Context: response model and limits, Accessibility and Vision adapters, and the command.
        .target(name: "ContextCore", dependencies: ["HelperKit"], swiftSettings: warningsAsErrors),
        .testTarget(name: "ContextCoreTests", dependencies: ["ContextCore", "HelperKit"], swiftSettings: warningsAsErrors),
        .target(
            name: "ContextAdapters", dependencies: ["HelperKit", "ContextCore"], swiftSettings: warningsAsErrors,
            linkerSettings: [.linkedFramework("Vision"), .linkedFramework("AppKit"), .linkedFramework("ApplicationServices")]),
        .executableTarget(
            name: "context-helper",
            dependencies: ["HelperKit", "CommandKit", "ContextCore", "ContextAdapters", argumentParser],
            swiftSettings: warningsAsErrors),
        .testTarget(name: "ContextHelperTests", dependencies: ["context-helper", "ContextAdapters", "ContextCore", "HelperKit", argumentParser], swiftSettings: warningsAsErrors),
    ])
