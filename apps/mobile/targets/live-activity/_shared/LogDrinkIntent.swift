import ActivityKit
import AppIntents
import Foundation

/// Runs in the app's process (iOS launches it in the background if needed).
@available(iOS 17.0, *)
struct LogDrinkIntent: LiveActivityIntent {
    static var title: LocalizedStringResource = "Log another drink"
    static var isDiscoverable = false

    func perform() async throws -> some IntentResult {
        if let activity = Activity<ProstActivityAttributes>.activities.first {
            await LiveActivityTap.handle(activity)
        }
        return .result()
    }
}

@available(iOS 17.0, *)
enum LiveActivityTap {
    static let inactivity: TimeInterval = 2 * 60 * 60

    /// Same rule as the server's attendance_with_totals view: a radler counts as a beer.
    static func countsAsBeer(_ drinkType: String) -> Bool {
        drinkType == "beer" || drinkType == "radler"
    }

    static func festivalToday(timezone: String, now: Date = Date()) -> String {
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .iso8601)
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.dateFormat = "yyyy-MM-dd"
        formatter.timeZone = TimeZone(identifier: timezone) ?? TimeZone(identifier: "Europe/Berlin")
        return formatter.string(from: now)
    }

    static func parseDate(_ value: String) -> Date? {
        let withFraction = ISO8601DateFormatter()
        withFraction.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return withFraction.date(from: value) ?? ISO8601DateFormatter().date(from: value)
    }

    /// Same rule as liveActivityStaleDate in packages/shared: two hours after the last log,
    /// but never past the festival day's midnight.
    static func staleDate(
        _ state: ProstActivityAttributes.ContentState,
        _ attributes: ProstActivityAttributes
    ) -> Date? {
        guard let lastLog = parseDate(state.lastLogAt) else { return nil }
        let inactiveAt = lastLog.addingTimeInterval(inactivity)
        var calendar = Calendar(identifier: .iso8601)
        calendar.timeZone = TimeZone(identifier: attributes.timezone) ?? TimeZone(identifier: "Europe/Berlin")!
        let formatter = DateFormatter()
        formatter.calendar = calendar
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = calendar.timeZone
        formatter.dateFormat = "yyyy-MM-dd"
        guard
            let dayStart = formatter.date(from: attributes.date),
            let midnight = calendar.date(byAdding: .day, value: 1, to: dayStart)
        else { return inactiveAt }
        return min(inactiveAt, midnight)
    }

    private static let gate = TapGate()

    static func matches(_ tap: PendingTap, _ attributes: ProstActivityAttributes) -> Bool {
        tap.festivalId == attributes.festivalId && tap.date == attributes.date
    }

    static func handle(_ activity: Activity<ProstActivityAttributes>) async {
        // One tap at a time: awaits below would otherwise interleave concurrent taps.
        await gate.acquire()
        defer { gate.release() }

        let attributes = activity.attributes
        var state = activity.content.state

        // Never log onto yesterday: a new festival day means a new surface.
        if festivalToday(timezone: attributes.timezone) != attributes.date {
            state.message = "newDay"
            await activity.end(.init(state: state, staleDate: nil), dismissalPolicy: .immediate)
            return
        }

        guard let userId = PendingTapStore.currentUserId() else {
            state.message = "openAppToSync"
            await activity.update(.init(state: state, staleDate: staleDate(state, attributes)))
            return
        }

        let tap = PendingTap(
            userId: userId,
            consumptionId: UUID().uuidString.lowercased(),
            festivalId: attributes.festivalId,
            date: attributes.date,
            drinkType: state.lastDrinkType,
            tentId: state.lastTentId,
            tappedAt: ISO8601DateFormatter().string(from: Date())
        )

        PendingTapStore.append(tap)
        state.drinkCount += 1
        if countsAsBeer(tap.drinkType) {
            state.beerCount += 1
        }
        state.pendingCount = PendingTapStore.read().filter { matches($0, attributes) }.count
        state.lastLogAt = tap.tappedAt
        state.message = nil
        await activity.update(.init(state: state, staleDate: staleDate(state, attributes)))

        var latest: LogDrinkResponse?
        var droppedCount = 0
        var droppedBeers = 0
        for queued in PendingTapStore.read() {
            // Never post one account's taps under another's session.
            if queued.userId != userId {
                PendingTapStore.remove(consumptionIds: [queued.consumptionId])
                continue
            }
            let isCurrent = matches(queued, attributes)
            do {
                let response = try await ActivityAPI.logDrink(baseUrl: attributes.apiBaseUrl, tap: queued)
                PendingTapStore.remove(consumptionIds: [queued.consumptionId])
                if isCurrent {
                    latest = response
                }
            } catch ActivityAPIError.noSession {
                state.message = "openAppToSync"
                break
            } catch ActivityAPIError.rejected(let code) {
                // Not retryable: drop it. Other days' taps never touch this display.
                PendingTapStore.remove(consumptionIds: [queued.consumptionId])
                if isCurrent {
                    droppedCount += 1
                    if countsAsBeer(queued.drinkType) {
                        droppedBeers += 1
                    }
                    state.message = code == "DATE_OUTSIDE_FESTIVAL" ? "festivalEnded" : "notLogged"
                }
            } catch {
                break
            }
        }

        let remaining = PendingTapStore.read().filter { matches($0, attributes) }
        if let latest {
            state.drinkCount = latest.drinkCount + remaining.count
            state.beerCount = latest.beerCount + remaining.filter { countsAsBeer($0.drinkType) }.count
            let newestVisit = latest.tentVisits.max {
                (parseDate($0.visitDate) ?? .distantPast) < (parseDate($1.visitDate) ?? .distantPast)
            }
            if let tentName = newestVisit?.tentName {
                state.tentName = tentName
            }
        } else {
            state.drinkCount = max(0, state.drinkCount - droppedCount)
            state.beerCount = max(0, state.beerCount - droppedBeers)
        }
        state.pendingCount = remaining.count

        if state.message == "festivalEnded" {
            await activity.end(.init(state: state, staleDate: nil), dismissalPolicy: .default)
            return
        }
        await activity.update(.init(state: state, staleDate: staleDate(state, attributes)))
    }
}

/// Async mutex: actors are reentrant across awaits, so they cannot serialize this.
@available(iOS 17.0, *)
final class TapGate: @unchecked Sendable {
    private let lock = NSLock()
    private var busy = false
    private var waiters: [CheckedContinuation<Void, Never>] = []

    func acquire() async {
        await withCheckedContinuation { (continuation: CheckedContinuation<Void, Never>) in
            lock.lock()
            if busy {
                waiters.append(continuation)
                lock.unlock()
            } else {
                busy = true
                lock.unlock()
                continuation.resume()
            }
        }
    }

    func release() {
        lock.lock()
        if waiters.isEmpty {
            busy = false
            lock.unlock()
        } else {
            let next = waiters.removeFirst()
            lock.unlock()
            next.resume()
        }
    }
}
