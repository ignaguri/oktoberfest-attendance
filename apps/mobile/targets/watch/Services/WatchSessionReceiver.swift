import Foundation
import WatchConnectivity

/// Receives session data forwarded from the iPhone via WCSession.transferUserInfo
/// and writes it into the shared App Group UserDefaults so TokenStore can read it.
///
/// Flow:
///   iPhone WatchSessionBridge.transferUserInfo → WCSession → here
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
        WCSession.default.delegate = self
        WCSession.default.activate()
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
        }
    }

    func session(_ session: WCSession, didReceiveUserInfo userInfo: [String: Any] = [:]) {
        guard let defaults = defaults else { return }
        let keys = ["accessToken", "refreshToken", "userId", "currentFestivalId", "expiresAt"]
        for key in keys {
            if let value = userInfo[key] {
                defaults.set(value, forKey: key)
            }
        }
        defaults.synchronize()
        print("[WatchSessionReceiver] Session data received and stored.")
    }
}
