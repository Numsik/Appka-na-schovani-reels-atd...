import Foundation

struct ScreenText {
    let text: String
    let confidence: Double
    // Normalized coordinates with the origin at the top left.
    let x: Double
    let y: Double
    let width: Double
    let height: Double
}

enum ReelsDetection {
    static func matches(_ regions: [ScreenText]) -> Bool {
        let readable = regions.filter { $0.confidence >= 0.65 }
        let top = readable.filter { $0.y > 0.035 && $0.y < 0.26 && $0.x < 0.75 }
            .map { normalize($0.text) }
        let hasReelsTitle = top.contains { $0 == "reels" || $0 == "instagram reels" }
        let hasFeedTabs = top.contains { $0.contains("for you") || $0.contains("pro tebe") }
            && top.contains { $0.contains("friends") || $0.contains("pratele") }
        let counts = readable.filter {
            $0.x > 0.76 && $0.width < 0.23 && $0.y > 0.28 && $0.y < 0.84
                && normalize($0.text).range(
                    of: #"^[0-9][0-9.,\s]*(k|m|b|tis\.?|mil\.?)?$"#,
                    options: .regularExpression
                ) != nil
        }
        // A vertical engagement rail separates the player from navigation tabs,
        // a profile's Reels grid, ordinary posts, and text mentioning Reels.
        let railSpan = (counts.map(\.y).max() ?? 0) - (counts.map(\.y).min() ?? 0)
        guard counts.count >= 3, railSpan >= 0.16 else { return false }
        let hasPlayerContext = readable.contains {
            guard $0.y > 0.56 && $0.y < 0.94 && $0.x < 0.76 else { return false }
            let value = normalize($0.text)
            return value.contains("original audio") || value.contains("puvodni zvuk")
                || value.contains("follow") || value.contains("sledovat")
        }
        return hasReelsTitle || (hasFeedTabs && hasPlayerContext)
    }

    private static func normalize(_ value: String) -> String {
        value.folding(options: [.diacriticInsensitive, .caseInsensitive], locale: Locale(identifier: "en_US_POSIX"))
            .trimmingCharacters(in: .whitespacesAndNewlines)
    }
}

struct DetectionGate {
    private(set) var consecutiveHits = 0
    private var previousTime: TimeInterval?
    let requiredHits: Int
    let maximumGap: TimeInterval

    init(requiredHits: Int = 3, maximumGap: TimeInterval = 3) {
        self.requiredHits = requiredHits
        self.maximumGap = maximumGap
    }

    mutating func observe(matches: Bool, at time: TimeInterval) -> Bool {
        if let previousTime, time < previousTime || time - previousTime > maximumGap {
            consecutiveHits = 0
        }
        previousTime = time
        consecutiveHits = matches ? consecutiveHits + 1 : 0
        return consecutiveHits >= requiredHits
    }

    mutating func reset() {
        consecutiveHits = 0
        previousTime = nil
    }
}
