import ActivityKit
import ExpoModulesCore
import Foundation

private let appGroup = "group.com.prostcounter.shared"
private let pendingKey = "liveActivityPendingTaps"
private let pendingLockFile = "liveActivityPendingTaps.lock"

/// An flock on a file in the App Group container. The widget's intent and the app's module
/// both edit the pending taps but can't share an NSLock across Swift modules; keep the two
/// copies (targets/live-activity/_shared/PendingTapStore.swift) on the same lock file.
private func withPendingLock<T>(_ body: () throws -> T) rethrows -> T {
    guard
        let url = FileManager.default
            .containerURL(forSecurityApplicationGroupIdentifier: appGroup)?
            .appendingPathComponent(pendingLockFile)
    else { return try body() }
    let descriptor = open(url.path, O_CREAT | O_RDWR, 0o644)
    guard descriptor >= 0 else { return try body() }
    defer { close(descriptor) }
    flock(descriptor, LOCK_EX)
    defer { flock(descriptor, LOCK_UN) }
    return try body()
}

public class LiveActivityModule: Module {
    private var tokenTask: Task<Void, Never>?

    public func definition() -> ModuleDefinition {
        Name("LiveActivity")

        Events("onPushToken")

        OnCreate {
            if #available(iOS 17.0, *), let activity = Activity<ProstActivityAttributes>.activities.first {
                self.observePushToken(activity)
            }
        }

        AsyncFunction("isSupported") { () -> Bool in
            guard #available(iOS 17.0, *) else { return false }
            return ActivityAuthorizationInfo().areActivitiesEnabled
        }

        AsyncFunction("start") { (attributesJson: String, stateJson: String, staleDate: String) in
            guard #available(iOS 17.0, *) else { return }
            let attributes = try JSONDecoder().decode(ProstActivityAttributes.self, from: Data(attributesJson.utf8))
            let state = try JSONDecoder().decode(ProstActivityAttributes.ContentState.self, from: Data(stateJson.utf8))
            for activity in Activity<ProstActivityAttributes>.activities {
                await activity.end(nil, dismissalPolicy: .immediate)
            }
            let activity = try Activity.request(
                attributes: attributes,
                content: .init(state: state, staleDate: Self.parseDate(staleDate)),
                pushType: .token
            )
            self.observePushToken(activity)
        }

        AsyncFunction("update") { (stateJson: String, staleDate: String) in
            guard #available(iOS 17.0, *) else { return }
            let state = try JSONDecoder().decode(ProstActivityAttributes.ContentState.self, from: Data(stateJson.utf8))
            for activity in Activity<ProstActivityAttributes>.activities {
                await activity.update(.init(state: state, staleDate: Self.parseDate(staleDate)))
            }
        }

        AsyncFunction("end") { () in
            guard #available(iOS 17.0, *) else { return }
            for activity in Activity<ProstActivityAttributes>.activities {
                await activity.end(nil, dismissalPolicy: .immediate)
            }
        }

        AsyncFunction("getRunningAttributes") { () -> String? in
            guard #available(iOS 17.0, *), let activity = Activity<ProstActivityAttributes>.activities.first else {
                return nil
            }
            let data = try JSONEncoder().encode(activity.attributes)
            return String(data: data, encoding: .utf8)
        }

        AsyncFunction("getRunningState") { () -> String? in
            guard #available(iOS 17.0, *), let activity = Activity<ProstActivityAttributes>.activities.first else {
                return nil
            }
            let state = activity.content.state
            // JSONEncoder drops nil optionals; the shared schema wants explicit nulls.
            let json: [String: Any] = [
                "drinkCount": state.drinkCount,
                "beerCount": state.beerCount,
                "tentName": state.tentName ?? NSNull(),
                "lastDrinkType": state.lastDrinkType,
                "lastTentId": state.lastTentId ?? NSNull(),
                "pendingCount": state.pendingCount,
                "lastLogAt": state.lastLogAt,
                "message": state.message ?? NSNull(),
            ]
            let data = try JSONSerialization.data(withJSONObject: json)
            return String(data: data, encoding: .utf8)
        }

        AsyncFunction("peekPendingTaps") { () -> String in
            UserDefaults(suiteName: appGroup)?.string(forKey: pendingKey) ?? "[]"
        }

        AsyncFunction("removePendingTaps") { (consumptionIds: [String]) in
            try withPendingLock {
                let defaults = UserDefaults(suiteName: appGroup)
                guard
                    let raw = defaults?.string(forKey: pendingKey),
                    let taps = try JSONSerialization.jsonObject(with: Data(raw.utf8)) as? [[String: Any]]
                else { return }
                let kept = taps.filter { tap in
                    guard let id = tap["consumptionId"] as? String else { return false }
                    return !consumptionIds.contains(id)
                }
                let data = try JSONSerialization.data(withJSONObject: kept)
                defaults?.set(String(data: data, encoding: .utf8), forKey: pendingKey)
            }
        }
    }

    private static func parseDate(_ value: String) -> Date? {
        let withFraction = ISO8601DateFormatter()
        withFraction.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return withFraction.date(from: value) ?? ISO8601DateFormatter().date(from: value)
    }

    @available(iOS 17.0, *)
    private func observePushToken(_ activity: Activity<ProstActivityAttributes>) {
        tokenTask?.cancel()
        tokenTask = Task { [weak self] in
            for await data in activity.pushTokenUpdates {
                let token = data.map { String(format: "%02x", $0) }.joined()
                #if targetEnvironment(simulator)
                let environment = "sandbox"
                #else
                let environment = "production"
                #endif
                self?.sendEvent("onPushToken", ["token": token, "apnsEnvironment": environment])
            }
        }
    }
}
