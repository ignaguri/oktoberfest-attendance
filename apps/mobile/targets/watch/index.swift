import SwiftUI

@main
struct watchEntry: App {
    init() {
        // Activate WCSession receiver so the watch can receive session tokens
        // forwarded from the iPhone via WatchSessionBridge.transferUserInfo.
        _ = WatchSessionReceiver.shared
    }

    var body: some Scene {
        WindowGroup {
            ContentView()
        }
    }
}
