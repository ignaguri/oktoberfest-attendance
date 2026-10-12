import Foundation

@available(iOS 17.0, *)
struct PendingTap: Codable, Equatable {
    /// Optional so taps from pre-release builds still decode; replay drops them.
    var userId: String?
    var consumptionId: String
    var festivalId: String
    var date: String
    var drinkType: String
    var tentId: String?
    var tappedAt: String
}

/// Offline "+1" taps, shared with the app through the App Group. The app
/// replays them on open (modules/live-activity peekPendingTaps / removePendingTaps).
@available(iOS 17.0, *)
enum PendingTapStore {
    static let appGroup = "group.com.prostcounter.shared"
    static let key = "liveActivityPendingTaps"
    static let lockFile = "liveActivityPendingTaps.lock"

    /// The signed-in user: the `sub` claim of the access token the app shares.
    /// Expiry doesn't matter here; it only says whose taps these are.
    static func currentUserId() -> String? {
        guard
            let token = UserDefaults(suiteName: appGroup)?.string(forKey: "accessToken"),
            !token.isEmpty
        else { return nil }
        let parts = token.split(separator: ".")
        guard parts.count == 3 else { return nil }
        var payload = parts[1].replacingOccurrences(of: "-", with: "+").replacingOccurrences(of: "_", with: "/")
        payload += String(repeating: "=", count: (4 - payload.count % 4) % 4)
        guard
            let data = Data(base64Encoded: payload),
            let claims = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
            let sub = claims["sub"] as? String, !sub.isEmpty
        else { return nil }
        return sub
    }

    static func read() -> [PendingTap] {
        withLock { readUnlocked() }
    }

    /// Mutations re-read under the lock, so a stale snapshot never overwrites a newer tap.
    static func append(_ tap: PendingTap) {
        withLock { writeUnlocked(readUnlocked() + [tap]) }
    }

    static func remove(consumptionIds: Set<String>) {
        withLock { writeUnlocked(readUnlocked().filter { !consumptionIds.contains($0.consumptionId) }) }
    }

    /// An flock on a file in the App Group container. The widget's intent and the app's module
    /// both edit the pending taps but can't share an NSLock across Swift modules; keep the two
    /// copies (modules/live-activity/ios/LiveActivityModule.swift) on the same lock file.
    private static func withLock<T>(_ body: () -> T) -> T {
        guard
            let url = FileManager.default
                .containerURL(forSecurityApplicationGroupIdentifier: appGroup)?
                .appendingPathComponent(lockFile)
        else { return body() }
        let descriptor = open(url.path, O_CREAT | O_RDWR, 0o644)
        guard descriptor >= 0 else { return body() }
        defer { close(descriptor) }
        flock(descriptor, LOCK_EX)
        defer { flock(descriptor, LOCK_UN) }
        return body()
    }

    private static func readUnlocked() -> [PendingTap] {
        guard
            let raw = UserDefaults(suiteName: appGroup)?.string(forKey: key),
            let data = raw.data(using: .utf8),
            let taps = try? JSONDecoder().decode([PendingTap].self, from: data)
        else { return [] }
        return taps
    }

    private static func writeUnlocked(_ taps: [PendingTap]) {
        guard
            let data = try? JSONEncoder().encode(taps),
            let raw = String(data: data, encoding: .utf8)
        else { return }
        UserDefaults(suiteName: appGroup)?.set(raw, forKey: key)
    }
}
