import Foundation

enum TokenStoreError: Error {
    case missingToken
    case expiredToken
}

struct Session {
    let accessToken: String
    let refreshToken: String
    let userId: String
    let currentFestivalId: String?
    let expiresAt: Date
}

/// Reads the Supabase session the iPhone has forwarded to us.
///
/// Tokens live in App Group `UserDefaults` (not Keychain) on purpose:
/// sharing a Keychain between iPhone and watch requires a shared keychain
/// group entitlement, but the JS side writes via @bacons/apple-targets
/// `ExtensionStorage`, which goes through `UserDefaults(suiteName:)` only.
/// Staying on App Group UserDefaults keeps the JS ↔ iPhone ↔ watch path
/// uniform — we don't need a second persistence layer just for the watch.
///
/// Blast radius is bounded to binaries signed with the same Apple team,
/// since App Group membership requires matching signing provenance.
final class TokenStore {
    static let appGroup = "group.com.prostcounter.shared"
    private let defaults: UserDefaults

    init() {
        self.defaults = UserDefaults(suiteName: Self.appGroup) ?? .standard
    }

    func read() -> Session? {
        guard
            let access = defaults.string(forKey: "accessToken"), !access.isEmpty,
            let refresh = defaults.string(forKey: "refreshToken"), !refresh.isEmpty,
            let userId = defaults.string(forKey: "userId"), !userId.isEmpty
        else { return nil }

        let festival = defaults.string(forKey: "currentFestivalId")
        let expiresString = defaults.string(forKey: "expiresAt") ?? "0"
        let expiresSeconds = TimeInterval(expiresString) ?? 0

        return Session(
            accessToken: access,
            refreshToken: refresh,
            userId: userId,
            currentFestivalId: (festival?.isEmpty == false) ? festival : nil,
            expiresAt: Date(timeIntervalSince1970: expiresSeconds)
        )
    }

    var isExpired: Bool {
        guard let session = read() else { return true }
        return session.expiresAt.timeIntervalSinceNow < 60
    }
}
