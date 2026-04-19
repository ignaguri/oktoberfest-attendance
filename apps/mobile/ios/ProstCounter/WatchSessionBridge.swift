import Foundation
import WatchConnectivity

/// Bridges App Group UserDefaults changes on the iPhone to the paired Apple Watch
/// via WCSession.transferUserInfo.
///
/// Flow:
///   JS (ExtensionStorage) → UserDefaults(suiteName:) → KVO here → WCSession.transferUserInfo
///
/// NOTE: This file is committed directly to ios/ProstCounter/ and is NOT wrapped in a
/// config plugin, so it will be wiped by `expo prebuild --clean`. A future slice should
/// wrap this in a config plugin (see apps/mobile/plugins/) so it survives prebuild.
final class WatchSessionBridge: NSObject {

    static let shared = WatchSessionBridge()

    private let appGroup = "group.com.prostcounter.shared"
    private let watchedKeys = ["accessToken", "refreshToken", "userId", "currentFestivalId", "expiresAt"]
    private var defaults: UserDefaults?
    private var observations: [NSKeyValueObservation] = []

    private override init() {
        super.init()
        guard WCSession.isSupported() else { return }
        defaults = UserDefaults(suiteName: appGroup)
        WCSession.default.delegate = self
        WCSession.default.activate()
        startObserving()
    }

    private func startObserving() {
        guard let defaults = defaults else { return }
        // Use NotificationCenter-based observation for UserDefaults changes
        // (KVO on UserDefaults requires the key to be registered; notification is more reliable)
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(defaultsDidChange(_:)),
            name: UserDefaults.didChangeNotification,
            object: defaults
        )
    }

    @objc private func defaultsDidChange(_ notification: Notification) {
        forwardToWatch()
    }

    private func forwardToWatch() {
        guard
            WCSession.default.activationState == .activated,
            WCSession.default.isPaired,
            WCSession.default.isWatchAppInstalled,
            let defaults = defaults
        else { return }

        var payload: [String: Any] = [:]
        for key in watchedKeys {
            if let value = defaults.object(forKey: key) {
                payload[key] = value
            }
        }
        guard !payload.isEmpty else { return }

        WCSession.default.transferUserInfo(payload)
    }

    deinit {
        NotificationCenter.default.removeObserver(self)
    }
}

// MARK: - WCSessionDelegate

extension WatchSessionBridge: WCSessionDelegate {

    func session(
        _ session: WCSession,
        activationDidCompleteWith activationState: WCSessionActivationState,
        error: Error?
    ) {
        if let error = error {
            print("[WatchSessionBridge] Activation error: \(error)")
            return
        }
        if activationState == .activated {
            // Forward current values immediately after activation
            forwardToWatch()
        }
    }

    func sessionDidBecomeInactive(_ session: WCSession) {
        // Required on iOS — nothing to do
    }

    func sessionDidDeactivate(_ session: WCSession) {
        // Required on iOS — reactivate to support Apple Watch switching
        WCSession.default.activate()
    }
}
