import Foundation
import os
import WatchConnectivity

private let log = Logger(subsystem: "com.prostcounter.watch", category: "receiver")

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
            guard let value = dict[key] else { continue }
            // TokenStore reads every key via `defaults.string(forKey:)`. If the
            // iPhone side ever drifts and sends a non-String (e.g. expiresAt as
            // a Double), a direct `defaults.set(value)` writes a non-string and
            // the reads silently return nil, stranding the user as unauth'd.
            if let string = value as? String {
                defaults.set(string, forKey: key)
            } else if let number = value as? NSNumber {
                defaults.set(String(describing: number), forKey: key)
            } else {
                log.error("Skipping key \(key, privacy: .public) with unsupported type \(String(describing: type(of: value)), privacy: .public)")
            }
        }
        log.info("Session data received and stored.")
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
            log.error("Activation error: \(error.localizedDescription, privacy: .public)")
            return
        }
        // Apply any context delivered while the session was not yet active.
        if activationState == .activated, !session.receivedApplicationContext.isEmpty {
            storeReceived(session.receivedApplicationContext)
        }
    }

    func session(_ session: WCSession, didReceiveApplicationContext applicationContext: [String: Any]) {
        storeReceived(applicationContext)
    }

    func session(_ session: WCSession, didReceiveMessage message: [String: Any]) {
        // Connection-test ping from the phone: reply with pong and stop.
        // Token payloads don't carry a `type` field, so this branch is safe.
        if let type = message["type"] as? String, type == "ping" {
            let nonce = message["nonce"] as? String ?? ""
            log.info("ping received nonce=\(nonce, privacy: .public) reachable=\(session.isReachable, privacy: .public)")
            // The phone only reaches us via sendMessage when the channel is
            // live — don't gate the pong on session.isReachable, which can
            // flicker between deliveries and would silently drop the reply.
            session.sendMessage(
                ["type": "pong", "nonce": nonce],
                replyHandler: nil,
                errorHandler: { error in
                    log.error("pong send error: \(error.localizedDescription, privacy: .public)")
                }
            )
            return
        }
        storeReceived(message)
    }

    func session(_ session: WCSession, didReceiveUserInfo userInfo: [String: Any] = [:]) {
        storeReceived(userInfo)
    }
}
