import SwiftUI

@main
struct WatchEntry: App {
    init() {
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
}
