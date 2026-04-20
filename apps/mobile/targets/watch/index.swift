import SwiftUI

@main
struct WatchEntry: App {
    init() {
        // Persist the user's language preference (mirrored from the iPhone via
        // the App Group) into `AppleLanguages`. Takes effect on the NEXT cold
        // launch — see `applyPreferredLanguage()` for the timing detail.
        Self.applyPreferredLanguage()

        // Activate WCSession receiver so the watch can persist session tokens
        // forwarded from the iPhone bridge (updateApplicationContext +
        // sendMessage fast path) into the App Group UserDefaults.
        _ = WatchSessionReceiver.shared
    }

    var body: some Scene {
        WindowGroup {
            ContentView()
        }
    }

    /// Reads `preferredLanguage` from the App Group UserDefaults (written by
    /// `syncLanguageToWatch` in apps/mobile/lib/watch-sync.ts) and overrides
    /// `AppleLanguages` in standard UserDefaults. Read once per process launch:
    /// `AppleLanguages` is resolved by the bundle before SwiftUI init runs, so
    /// this write only takes effect on the NEXT cold launch.
    private static func applyPreferredLanguage() {
        guard
            let defaults = UserDefaults(suiteName: TokenStore.appGroup),
            let lang = defaults.string(forKey: "preferredLanguage"),
            ["en", "de", "es"].contains(lang)
        else {
            // No preference synced yet — fall through to device locale.
            return
        }
        let standard = UserDefaults.standard
        // Only write when the value actually changes, so we avoid churning
        // cfprefsd on every cold launch. Synchronize to force an immediate
        // flush to disk — without it, a short-lived process may exit before
        // cfprefsd persists the write, and the next launch reads the stale
        // value from disk.
        let currentLanguages = standard.array(forKey: "AppleLanguages") as? [String]
        if currentLanguages != [lang] {
            standard.set([lang], forKey: "AppleLanguages")
            standard.synchronize()
        }
    }
}
