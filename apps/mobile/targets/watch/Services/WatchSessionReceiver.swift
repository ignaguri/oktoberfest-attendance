import Foundation
import WatchConnectivity

/// Receives session data forwarded from the iPhone via WCSession and writes it
/// into the shared App Group UserDefaults so TokenStore can read it.
///
/// Handles three delivery paths:
///   - updateApplicationContext: simulator-compatible, delivers latest context
///   - sendMessage: real-time delivery when watch app is in foreground
///   - transferUserInfo: legacy queued delivery (kept for backward compatibility)
///
/// Flow:
///   iPhone WatchSessionBridge → WCSession → here
///     → UserDefaults(suiteName: group.com.prostcounter.shared)
///     → TokenStore.read()
final class WatchSessionReceiver: NSObject {

    static let shared = WatchSessionReceiver()

    private let appGroup = TokenStore.appGroup
    private var defaults: UserDefaults?

    private override init() {
        super.init()
        defaults = UserDefaults(suiteName: appGroup)
        guard WCSession.isSupported() else { return }
        let session = WCSession.default
        session.delegate = self
        session.activate()
        // Apply any context that was delivered before activation completes.
        // receivedApplicationContext may already be populated if the iPhone sent
        // a context while the watch app was not running.
        if !session.receivedApplicationContext.isEmpty {
            storeReceived(session.receivedApplicationContext)
        }
    }

    // MARK: - Private helpers

    private func storeReceived(_ dict: [String: Any]) {
        guard let defaults = defaults else { return }
        let keys = ["accessToken", "refreshToken", "userId", "currentFestivalId", "expiresAt"]
        for key in keys {
            if let value = dict[key] {
                defaults.set(value, forKey: key)
            }
        }
        defaults.synchronize()
        print("[WatchSessionReceiver] Session data received and stored.")
    }
}

// MARK: - WCSessionDelegate

extension WatchSessionReceiver: WCSessionDelegate {

    func session(
        _ session: WCSession,
        activationDidCompleteWith activationState: WCSessionActivationState,
        error: Error?
    ) {
        if let error = error {
            print("[WatchSessionReceiver] Activation error: \(error)")
            return
        }
        // Apply any context delivered while the session was not yet active.
        if activationState == .activated, !session.receivedApplicationContext.isEmpty {
            storeReceived(session.receivedApplicationContext)
        }
    }

    // updateApplicationContext: simulator-compatible persistent delivery.
    func session(_ session: WCSession, didReceiveApplicationContext applicationContext: [String: Any]) {
        storeReceived(applicationContext)
    }

    // sendMessage: real-time delivery when watch app is in foreground.
    func session(_ session: WCSession, didReceiveMessage message: [String: Any]) {
        storeReceived(message)
    }

    // transferUserInfo: legacy queued delivery (backward compatibility).
    func session(_ session: WCSession, didReceiveUserInfo userInfo: [String: Any] = [:]) {
        storeReceived(userInfo)
    }
}
