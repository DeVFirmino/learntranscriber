import Foundation

/// Word-level text comparison for live transcripts, whose words the recognizer keeps revising.
public enum TextAlignment {
    /// A token lowercased, with only its letters and digits.
    public static func word(_ token: String) -> String {
        String(token.lowercased().filter { $0.isLetter || $0.isNumber })
    }

    /// The non-empty normalized words of `text`.
    public static func words(_ text: String) -> [String] {
        text.split(whereSeparator: \.isWhitespace).map { word(String($0)) }.filter { $0.isEmpty == false }
    }

    /// `text` as normalized words separated by single spaces.
    public static func normalized(_ text: String) -> String {
        words(text).joined(separator: " ")
    }

    /// Where `saved` ends inside `words`, found by the longest common subsequence of words. Only an alignment that
    /// starts and ends within `slack` words of the saved text's edges counts.
    public static func alignedEnd(of saved: [String], in words: [String], slack: Int) -> Int? {
        let rows = saved.count, columns = words.count
        guard rows > 0, columns > 0 else { return nil }
        var table = [[Int]](repeating: [Int](repeating: 0, count: columns + 1), count: rows + 1)
        for row in 1...rows {
            for column in 1...columns {
                table[row][column] = saved[row - 1] == words[column - 1] && saved[row - 1].isEmpty == false
                    ? table[row - 1][column - 1] + 1
                    : max(table[row - 1][column], table[row][column - 1])
            }
        }
        var pairs: [(saved: Int, word: Int)] = []
        var row = rows, column = columns
        while row > 0, column > 0 {
            if saved[row - 1] == words[column - 1], saved[row - 1].isEmpty == false {
                pairs.append((row - 1, column - 1))
                row -= 1
                column -= 1
            } else if table[row - 1][column] >= table[row][column - 1] {
                row -= 1
            } else {
                column -= 1
            }
        }
        guard let last = pairs.first, let first = pairs.last else { return nil }
        guard first.saved <= slack, first.word <= slack,
              rows - 1 - last.saved <= slack else { return nil }
        return last.word + 1
    }

    /// One minus the edit distance over the longer length.
    public static func similarity(_ left: String, _ right: String) -> Double {
        let a = Array(left), b = Array(right)
        guard a.isEmpty == false, b.isEmpty == false else { return a == b ? 1 : 0 }
        var previous = Array(0...b.count)
        for i in 1...a.count {
            var current = [i] + [Int](repeating: 0, count: b.count)
            for j in 1...b.count {
                current[j] = min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + (a[i - 1] == b[j - 1] ? 0 : 1))
            }
            previous = current
        }
        return 1 - Double(previous[b.count]) / Double(max(a.count, b.count))
    }
}
