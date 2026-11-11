/// Rules the helpers apply to the raw argument list before typed parsing.
extension [String] {
    /// The token following the first `name`, or `nil` when `name` is absent or nothing follows it.
    public func value(after name: String) -> String? {
        guard let index = firstIndex(of: name), index + 1 < count else { return nil }
        return self[index + 1]
    }

    /// The arguments with each option in `options` kept only where it first appears, together with its value.
    /// The helpers always honoured the first value of a repeated option; typed parsing would take the last.
    public func keepingFirstOccurrence(of options: Set<String>) -> [String] {
        var seen: Set<String> = []
        var result: [String] = []
        var index = 0
        while index < count {
            let token = self[index]
            if options.contains(token) {
                let hasValue = index + 1 < count
                if seen.insert(token).inserted {
                    result.append(token)
                    if hasValue { result.append(self[index + 1]) }
                }
                index += hasValue ? 2 : 1
                continue
            }
            result.append(token)
            index += 1
        }
        return result
    }
}
