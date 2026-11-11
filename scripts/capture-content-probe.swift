import AppKit
import ScreenCaptureKit

@main
struct Probe {
    @MainActor static func main() async {
        do {
            guard CommandLine.arguments.count == 3, let pid = Int32(CommandLine.arguments[1]), let app = NSRunningApplication(processIdentifier: pid) else { throw NSError(domain: "Diagnostic", code: 1) }
            guard app.bundleIdentifier == "dev.danieldias.learntranscriber" else { throw NSError(domain: "DiagnosticTarget", code: 1) }
            let directory = URL(fileURLWithPath: CommandLine.arguments[2], isDirectory: true)
            try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true, attributes: [.posixPermissions: 0o700])
            var result: [String: Any] = ["pid": pid, "bundleIdentifier": app.bundleIdentifier ?? "", "bundlePath": app.bundleURL?.path ?? "", "activationPolicy": app.activationPolicy.rawValue, "hidden": app.isHidden]
            if let icon = app.icon, let data = icon.tiffRepresentation, let bitmap = NSBitmapImageRep(data: data), let png = bitmap.representation(using: .png, properties: [:]) { try png.write(to: directory.appendingPathComponent("running-app-icon.png")); result["nativeIconCaptured"] = true }
            let content = try await SCShareableContent.excludingDesktopWindows(false, onScreenWindowsOnly: false)
            let windows = content.windows.filter { $0.owningApplication?.processID == pid && $0.frame.width >= 80 && $0.frame.height >= 40 }
            var captures: [[String: Any]] = []
            for window in windows {
                let filter = SCContentFilter(desktopIndependentWindow: window)
                let config = SCStreamConfiguration()
                config.width = Int(window.frame.width)
                config.height = Int(window.frame.height)
                config.showsCursor = false
                let cg = try await SCScreenshotManager.captureImage(contentFilter: filter, configuration: config)
                let png = NSBitmapImageRep(cgImage: cg).representation(using: .png, properties: [:])!
                let bitmap = NSBitmapImageRep(cgImage: cg)
                var visiblePixels = 0
                if bitmap.hasAlpha, bitmap.bitsPerSample == 8, let bytes = bitmap.bitmapData {
                    let alphaOffset = bitmap.bitmapFormat.contains(.alphaFirst) ? 0 : bitmap.samplesPerPixel - 1
                    for y in 0..<bitmap.pixelsHigh {
                        for x in 0..<bitmap.pixelsWide {
                            if bytes[y * bitmap.bytesPerRow + x * bitmap.samplesPerPixel + alphaOffset] != 0 { visiblePixels += 1 }
                        }
                    }
                } else { visiblePixels = -1 }
                let name = "screenkit-window-\(window.windowID).png"
                try png.write(to: directory.appendingPathComponent(name))
                captures.append(["id": window.windowID, "width": config.width, "height": config.height, "onScreen": window.isOnScreen, "image": name, "pixelWidth": cg.width, "pixelHeight": cg.height, "nonTransparentPixels": visiblePixels])
            }
            result["screenCaptureKitWindows"] = captures
            let data = try JSONSerialization.data(withJSONObject: result, options: [.prettyPrinted, .sortedKeys])
            print(String(decoding: data, as: UTF8.self))
        } catch { print("Native diagnostic failed: \(error)"); exit(1) }
    }
}
