import Foundation

/// Remembers which tents the post-Prost crowd prompt already asked about today,
/// so another drink in the same tent does not reopen it. Same rule as
/// apps/mobile/lib/crowd/prompt-memory.ts, but the two stores are separate:
/// a tent asked about on the phone can still be asked once on the watch.
///
/// Only the latest festival day for one user is kept: a record from an earlier
/// day or another account reads as empty. Showing the prompt counts, whether
/// the user reports or skips.
struct CrowdPromptMemory {
    private static let key = "crowdPromptPrompted"
    private let defaults: UserDefaults

    init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
    }

    func promptedTentIds(userId: String, date: String) -> [String] {
        guard
            let record = defaults.dictionary(forKey: Self.key),
            record["userId"] as? String == userId,
            record["date"] as? String == date,
            let tentIds = record["tentIds"] as? [String]
        else { return [] }
        return tentIds
    }

    func record(tentId: String, userId: String, date: String) {
        var tentIds = promptedTentIds(userId: userId, date: date)
        if !tentIds.contains(tentId) {
            tentIds.append(tentId)
        }
        defaults.set(["userId": userId, "date": date, "tentIds": tentIds], forKey: Self.key)
    }
}
