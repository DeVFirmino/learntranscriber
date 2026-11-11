import Cocoa

// Inspect only the explicitly selected app's window metadata; never capture pixels.
guard CommandLine.arguments.count == 2, let target = Int(CommandLine.arguments[1]) else { exit(2) }
let windows = CGWindowListCopyWindowInfo([.optionAll, .excludeDesktopElements], kCGNullWindowID) as? [[String: Any]] ?? []
let selected = windows.filter { ($0[kCGWindowOwnerPID as String] as? Int) == target }.map { window in
    ["id": window[kCGWindowNumber as String] ?? -1,
     "sharingState": window[kCGWindowSharingState as String] ?? -1,
     "onScreen": window[kCGWindowIsOnscreen as String] ?? false] as [String: Any]
}
let data = try JSONSerialization.data(withJSONObject: selected, options: [.sortedKeys])
print(String(decoding: data, as: UTF8.self))
