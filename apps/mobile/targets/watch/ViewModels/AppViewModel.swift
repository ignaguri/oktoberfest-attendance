import CoreLocation
import Foundation
import SwiftUI
import WatchConnectivity

@MainActor
final class AppViewModel: ObservableObject {
    enum DrinkType: String, CaseIterable, Identifiable, Encodable {
        case beer = "beer"
        case radler = "radler"
        case alcoholFree = "alcohol_free"
        case wine = "wine"
        case softDrink = "soft_drink"

        var id: String { rawValue }

        var label: String {
            switch self {
            case .beer: return String(localized: "watch.drink.beer")
            case .radler: return String(localized: "watch.drink.radler")
            case .alcoholFree: return String(localized: "watch.drink.alcohol_free")
            case .wine: return String(localized: "watch.drink.wine")
            case .softDrink: return String(localized: "watch.drink.soft_drink")
            }
        }

        var emoji: String {
            switch self {
            case .beer: return "🍺"
            case .radler: return "🍋"
            case .alcoholFree: return "🚫"
            case .wine: return "🍷"
            case .softDrink: return "🥤"
            }
        }
    }

    enum Status: Equatable {
        case idle
        case loading
        case logging
        case success
        case needsRetry
        case noSession
        case noFestival
        case festivalNotStarted
        case festivalEnded
    }

    /// Watch-side crowd levels. Server enum is empty|moderate|crowded|full;
    /// we skip "full" to keep the small-screen picker to 3 actions + Skip.
    /// Case names mirror the mobile/web translation keys under `crowdReport.levels.*`
    /// so the shared i18n strings can be reused verbatim.
    enum CrowdLevel: String, CaseIterable, Identifiable, Encodable {
        case empty = "empty"
        case moderate = "moderate"
        case crowded = "crowded"

        var id: String { rawValue }

        /// User-facing label shown on the picker button.
        var label: String {
            switch self {
            case .empty: return String(localized: "watch.crowd.empty")
            case .moderate: return String(localized: "watch.crowd.moderate")
            case .crowded: return String(localized: "watch.crowd.crowded")
            }
        }
    }

    @Published private(set) var status: Status = .idle
    @Published private(set) var drinkCount: Int = 0
    @Published private(set) var beerCount: Int = 0
    @Published private(set) var currentTent: ResolvedTent = ResolvedTent(
        tentId: nil,
        tentName: TentResolver.noTentPlaceholder,
        source: .none
    )
    @Published private(set) var festivalId: String? = nil
    @Published private(set) var festival: Festival? = nil
    // Derived from festivals.beerCost; used as pricePaidCents on log POST to satisfy
    // the server's price_paid_cents >= base_price_cents constraint. Defaults to
    // festival beer price so all drink types pass the check even without a
    // per-drink-type price resolver on the watch (MVP limitation).
    /// System default beer price in cents. Mirrors DEFAULT_DRINK_PRICES.beer in
    /// packages/shared/src/schemas/pricing.schema.ts. Used as the pricePaidCents
    /// fallback when the festival has no explicit beerCost, so the server's
    /// price_paid_cents >= base_price_cents constraint is still satisfied.
    static let defaultBeerCostCents: Int = 1620

    @Published private(set) var beerCostCents: Int = AppViewModel.defaultBeerCostCents
    /// GPS-nearby tents fetched during bootstrap; used to auto-pick a tent.
    @Published private(set) var nearbyTents: [NearbyTent] = []
    /// Full tent roster for the active festival (GET /tents). Drives the
    /// picker so the user can pick any tent regardless of GPS.
    @Published private(set) var festivalTents: [FestivalTent] = []
    /// When non-nil, MainView surfaces the CrowdPromptView for this tent.
    /// Set after a Prost in a tent the prompt hasn't asked about yet today.
    @Published var promptingCrowdForTentId: String? = nil

    private let api: APIClient
    private let tokenStore: TokenStore
    private let locationService: LocationService
    private let crowdPromptMemory = CrowdPromptMemory()
    private let dateFormatter: DateFormatter
    /// Single-flight guard so concurrent callers funnel through the same
    /// in-flight bootstrap instead of kicking off parallel fetches that
    /// race on the @Published properties.
    private var bootstrapTask: Task<Void, Never>?

    init(api: APIClient = APIClient(), tokenStore: TokenStore = TokenStore(), locationService: LocationService = LocationService()) {
        self.api = api
        self.tokenStore = tokenStore
        self.locationService = locationService
        let f = DateFormatter()
        f.calendar = .init(identifier: .iso8601)
        f.locale = .init(identifier: "en_US_POSIX")
        f.dateFormat = "yyyy-MM-dd"
        // Must match packages/shared/src/utils/date-utils.ts formatDateForDatabase:
        // dates are festival-local, not device-local, so a watch in UTC-5 at
        // 11 PM Munich time doesn't post yesterday. Bootstrap swaps in the
        // festival's own timezone.
        f.timeZone = Self.defaultTimeZone
        self.dateFormatter = f
    }

    private static let defaultTimeZone = TimeZone(identifier: "Europe/Berlin")!

    var todayString: String { dateFormatter.string(from: Date()) }

    var festivalTimeZone: TimeZone { dateFormatter.timeZone }

    var festivalStartDate: Date? {
        festival.flatMap { dateFormatter.date(from: $0.startDate) }
    }

    /// No festival to log against, so MainView shows the empty state instead of Prost!.
    var isOutsideFestival: Bool {
        status == .noFestival || status == .festivalNotStarted || status == .festivalEnded
    }

    /// On wrist raise: an empty state rechecks with the server, while the
    /// Prost! screen only needs the cached dates to notice the festival ended.
    func recheckOnForeground() async {
        if isOutsideFestival {
            await bootstrap()
        } else if status != .loading && status != .logging, let festival,
                  let outOfRange = Self.dateRangeStatus(today: todayString, festival: festival) {
            status = outOfRange
        }
    }

    func bootstrap() async {
        // Skip if already loaded and healthy.
        if festivalId != nil && status == .idle { return }
        // If a bootstrap is already running, await that task instead of
        // starting a second one that would race on the @Published state.
        if let existing = bootstrapTask {
            await existing.value
            return
        }
        let task = Task { @MainActor in
            await self.performBootstrap()
        }
        bootstrapTask = task
        await task.value
        bootstrapTask = nil
    }

    private func performBootstrap() async {
        // Keep the empty state up while rechecking, so it doesn't flash Prost!.
        if !isOutsideFestival {
            status = .loading
        }
        guard let session = tokenStore.read() else {
            status = .noSession
            return
        }
        guard let festId = session.currentFestivalId, !festId.isEmpty else {
            festivalId = nil
            festival = nil
            dateFormatter.timeZone = Self.defaultTimeZone
            status = .noFestival
            return
        }
        festivalId = festId

        do {
            // Fetched first: today's date depends on the festival's timezone.
            let festival = try await api.fetchFestival(id: festId)
            self.festival = festival
            // A drink tapped during the fetch clears festivalId (it looks like
            // a festival switch) and then waits on this bootstrap: restore it,
            // unless the iPhone really did switch festival meanwhile.
            if festivalId == nil, tokenStore.read()?.currentFestivalId == festId {
                festivalId = festId
            }
            dateFormatter.timeZone = festival.timezone.flatMap(TimeZone.init(identifier:)) ?? Self.defaultTimeZone
            if let outOfRange = Self.dateRangeStatus(today: todayString, festival: festival) {
                status = outOfRange
                return
            }
            status = .loading

            async let attendanceTask = api.fetchTodayAttendance(
                festivalId: festId,
                isoDate: todayString
            )
            async let nearbyTask: [NearbyTent] = {
                guard let location = try? await locationService.currentLocation() else { return [] }
                return (try? await api.fetchNearbyTents(
                    latitude: location.coordinate.latitude,
                    longitude: location.coordinate.longitude,
                    festivalId: festId
                )) ?? []
            }()
            async let festivalTentsTask: [FestivalTent] = {
                (try? await api.fetchFestivalTents(festivalId: festId)) ?? []
            }()

            let attendance = try await attendanceTask
            let fetchedNearby = await nearbyTask
            let fetchedFestivalTents = await festivalTentsTask

            drinkCount = attendance?.drinkCount ?? 0
            beerCount = attendance?.beerCount ?? 0
            if let beerCost = festival.beerCost, beerCost > 0 {
                beerCostCents = Int((beerCost * 100).rounded())
            } else {
                // Festival hasn't set a beer price yet — fall back to the
                // shared system default so logs still satisfy the server's
                // price_paid_cents >= base_price_cents constraint.
                beerCostCents = Self.defaultBeerCostCents
            }
            nearbyTents = fetchedNearby
            festivalTents = fetchedFestivalTents

            // Priority: today's attendance tent (user checked in on phone) → GPS-nearest → none.
            currentTent = TentResolver.resolve(
                attendance: attendance,
                nearbyTents: fetchedNearby
            )

            status = .idle
        } catch APIError.noSession, APIError.unauthorized {
            // .unauthorized means the refresh attempt in APIClient.authorize
            // did not recover the session; retrying won't help. Fall through
            // to the "sign in on iPhone first" UX.
            status = .noSession
        } catch {
            // An offline recheck keeps the empty state rather than offering
            // Prost!, unless the iPhone switched festival and it's now stale.
            if !isOutsideFestival || festival?.id != festivalId {
                status = .needsRetry
            }
        }
    }

    func logDrink(_ type: DrinkType) async {
        // If the iPhone has changed currentFestivalId since we cached it
        // (e.g. the user switched festivals on the phone while the watch app
        // stayed alive), re-bootstrap so we don't keep logging against the
        // old festival. Otherwise bootstrap only when cached id is missing.
        let latestFestivalId = tokenStore.read()?.currentFestivalId
        if festivalId == nil || festival?.id != festivalId
            || (latestFestivalId != nil && latestFestivalId != festivalId) {
            // Force bootstrap to re-fetch even if status == .idle.
            festivalId = nil
            await bootstrap()
        }
        guard let festId = festivalId, let festival, festival.id == festId else {
            // bootstrap failed or no festival available — leave status as-is (noSession / noFestival / needsRetry).
            return
        }
        // An app left open past midnight on the last day.
        if let outOfRange = Self.dateRangeStatus(today: todayString, festival: festival) {
            status = outOfRange
            return
        }
        // Capture the tent before the POST so the prompt asks about the tent
        // the drink was logged against.
        let tentAtLogTime = currentTent.tentId

        status = .logging

        let body = LogConsumptionRequest(
            festivalId: festId,
            date: todayString,
            tentId: tentAtLogTime,
            drinkType: type,
            basePriceCents: beerCostCents,
            pricePaidCents: beerCostCents
        )

        var lastError: Error?
        for attempt in 1...3 {
            do {
                let result = try await api.logConsumption(body)
                drinkCount = result.drinkCount
                beerCount = result.beerCount
                // Mirror QuickAttendanceSheet's Save flow — when a tent is
                // selected, also replace the day's tent list so the iPhone
                // UI reflects the watch's pick on its next refetch. Failure
                // here is best-effort: the drink is already logged, so we
                // don't want to roll back or downgrade status to needsRetry.
                if let tentId = tentAtLogTime {
                    do {
                        try await api.updateAttendanceTents(
                            festivalId: festId,
                            date: todayString,
                            tentIds: [tentId]
                        )
                    } catch {
                        print("updateAttendanceTents failed (non-fatal): \(error)")
                    }
                }
                notifyIPhoneOfDrinkLog()
                status = .success
                promptForCrowdIfNeeded(tentId: tentAtLogTime, date: body.date)
                return
            } catch APIError.noSession, APIError.unauthorized {
                // Refresh in APIClient.authorize already failed — retrying
                // won't help. Surface the sign-in prompt immediately.
                status = .noSession
                return
            } catch APIError.httpStatus(let code, let data)
                where (400..<500).contains(code) && code != 408 && code != 429 {
                // A rejected request fails the same way on retry.
                let errorCode = (try? JSONDecoder().decode(APIErrorResponse.self, from: data))?.error.code
                if errorCode == "DATE_OUTSIDE_FESTIVAL" {
                    // The app outlived the festival's last day, or its dates
                    // changed: refetch so bootstrap lands on the empty state.
                    festivalId = nil
                    await bootstrap()
                }
                if status == .logging || status == .idle {
                    status = .needsRetry
                }
                return
            } catch {
                lastError = error
                if attempt < 3 {
                    let delayMs: UInt64 = attempt == 1 ? 500 : 2_000
                    try? await Task.sleep(nanoseconds: delayMs * 1_000_000)
                }
            }
        }
        print("logDrink failed after 3 attempts: \(String(describing: lastError))")
        status = .needsRetry
    }

    /// Manually override the active tent (called from TentPickerView).
    func changeTent(to tent: FestivalTent) {
        currentTent = ResolvedTent(
            tentId: tent.tentId,
            tentName: tent.name,
            source: .manualOverride
        )
    }

    func acknowledgeSuccess() {
        if status == .success { status = .idle }
    }

    /// nil while the festival is on. Dates are YYYY-MM-DD, so string order is date order.
    static func dateRangeStatus(today: String, festival: Festival) -> Status? {
        if today < festival.startDate { return .festivalNotStarted }
        if today > festival.endDate { return .festivalEnded }
        return nil
    }

    /// Pure helper so the detection rule can be exercised without touching the API.
    /// Prompt once per tent per day, and only when we know which tent to
    /// attribute the crowd level to.
    static func shouldPromptForCrowd(tentId: String?, promptedTentIds: [String]) -> Bool {
        guard let tentId else { return false }
        return !promptedTentIds.contains(tentId)
    }

    /// `date` is the drink's day, so a Prost right before midnight is
    /// remembered against the day it was logged on.
    private func promptForCrowdIfNeeded(tentId: String?, date: String) {
        guard let tentId, let userId = tokenStore.read()?.userId else { return }
        let prompted = crowdPromptMemory.promptedTentIds(userId: userId, date: date)
        guard Self.shouldPromptForCrowd(tentId: tentId, promptedTentIds: prompted) else { return }
        crowdPromptMemory.record(tentId: tentId, userId: userId, date: date)
        promptingCrowdForTentId = tentId
    }

    /// Submit the selected crowd level for the prompt's tent. Failures are
    /// swallowed — the crowd report is a bonus, and we don't want a network
    /// error to disrupt the Prost! success flow.
    func submitCrowdReport(level: CrowdLevel) async {
        guard let tentId = promptingCrowdForTentId, let festId = festivalId else {
            promptingCrowdForTentId = nil
            return
        }
        do {
            try await api.postCrowdReport(
                tentId: tentId,
                body: CrowdReportRequest(festivalId: festId, crowdLevel: level)
            )
        } catch {
            print("submitCrowdReport failed: \(error)")
        }
        promptingCrowdForTentId = nil
    }

    /// Dismiss the crowd prompt without posting (user tapped Skip or the sheet).
    func dismissCrowdPrompt() {
        promptingCrowdForTentId = nil
    }

    #if DEBUG
    /// Debug-only sanity checks for the crowd prompt rule.
    /// Invoked from CrowdPromptView_Previews so the assertions run whenever
    /// previews render, without requiring an XCTest target.
    static func runCrowdDetectionAssertions() {
        assert(
            Self.shouldPromptForCrowd(tentId: "t1", promptedTentIds: []),
            "First drink in a tent should prompt"
        )
        assert(
            !Self.shouldPromptForCrowd(tentId: nil, promptedTentIds: []),
            "A drink without a tent should not prompt"
        )
        assert(
            !Self.shouldPromptForCrowd(tentId: "t1", promptedTentIds: ["t1"]),
            "Another drink in the same tent should not prompt"
        )
        assert(
            Self.shouldPromptForCrowd(tentId: "t2", promptedTentIds: ["t1"]),
            "Moving to a new tent should prompt"
        )
        print("[AppViewModel] crowd detection assertions passed ✓")
    }
    #endif

    /// Fire-and-forget WCSession ping so the iPhone bridge can prompt React Query
    /// to invalidate attendance data. Safe to call even if the iPhone isn't
    /// reachable — sendMessage fails silently, and the phone will still catch up
    /// via refetchOnWindowFocus when the user next brings it to the foreground.
    private func notifyIPhoneOfDrinkLog() {
        guard WCSession.isSupported() else { return }
        let session = WCSession.default
        guard session.activationState == .activated else { return }
        let payload: [String: Any] = ["type": "drinkLogged"]
        if session.isReachable {
            session.sendMessage(payload, replyHandler: nil, errorHandler: nil)
        }
    }
}
