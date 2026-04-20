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
            case .beer: return "Beer"
            case .radler: return "Radler"
            case .alcoholFree: return "Alcohol-free"
            case .wine: return "Wine"
            case .softDrink: return "Soft drink"
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
    }

    /// Watch-side crowd levels. Server enum is empty|moderate|crowded|full;
    /// we skip "full" to keep the small-screen picker to 3 actions + Skip.
    enum CrowdLevel: String, CaseIterable, Identifiable, Encodable {
        case empty = "empty"
        case busy = "moderate"
        case packed = "crowded"

        var id: String { rawValue }

        /// User-facing label shown on the picker button.
        var label: String {
            switch self {
            case .empty: return "Empty"
            case .busy: return "Busy"
            case .packed: return "Packed"
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
    /// Set when the tapped Prost was the first drink of the day against a known tent.
    @Published var promptingCrowdForTentId: String? = nil

    private let api: APIClient
    private let tokenStore: TokenStore
    private let locationService: LocationService
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
        // Must match packages/shared/src/utils/date-utils.ts formatDateForDatabase —
        // the server validates `date` as a regex only (YYYY-MM-DD) and trusts the
        // client to format in festival-local time. Using .current would send the
        // device's local calendar date, which drifts from the festival day across
        // time zones (e.g. a watch in UTC-5 at 11 PM Munich would post yesterday).
        f.timeZone = TimeZone(identifier: "Europe/Berlin")!
        self.dateFormatter = f
    }

    var todayString: String { dateFormatter.string(from: Date()) }

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
        status = .loading
        guard let session = tokenStore.read() else {
            status = .noSession
            return
        }
        guard let festId = session.currentFestivalId, !festId.isEmpty else {
            status = .noFestival
            return
        }
        festivalId = festId

        do {
            async let attendanceTask = api.fetchTodayAttendance(
                festivalId: festId,
                isoDate: todayString
            )
            async let festivalTask = api.fetchFestival(id: festId)
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
            let festival = try await festivalTask
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
            status = .needsRetry
        }
    }

    func logDrink(_ type: DrinkType) async {
        // If the iPhone has changed currentFestivalId since we cached it
        // (e.g. the user switched festivals on the phone while the watch app
        // stayed alive), re-bootstrap so we don't keep logging against the
        // old festival. Otherwise bootstrap only when cached id is missing.
        let latestFestivalId = tokenStore.read()?.currentFestivalId
        if festivalId == nil || (latestFestivalId != nil && latestFestivalId != festivalId) {
            // Force bootstrap to re-fetch even if status == .idle.
            festivalId = nil
            await bootstrap()
        }
        guard let festId = festivalId else {
            // bootstrap failed or no festival available — leave status as-is (noSession / noFestival / needsRetry).
            return
        }
        // Capture the pre-log state so we can decide whether to surface the
        // crowd prompt once the POST succeeds.
        let tentAtLogTime = currentTent.tentId
        let shouldPromptAfter = Self.shouldPromptForCrowd(
            priorDrinkCount: drinkCount,
            tentId: tentAtLogTime
        )

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
                if shouldPromptAfter, let tentId = tentAtLogTime {
                    promptingCrowdForTentId = tentId
                }
                return
            } catch APIError.noSession, APIError.unauthorized {
                // Refresh in APIClient.authorize already failed — retrying
                // won't help. Surface the sign-in prompt immediately.
                status = .noSession
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

    /// Pure helper so the detection rule can be exercised without touching the API.
    /// Prompt only when this drink is the first of the day AND we actually know
    /// which tent to attribute the crowd level to.
    static func shouldPromptForCrowd(priorDrinkCount: Int, tentId: String?) -> Bool {
        priorDrinkCount == 0 && tentId != nil
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
    /// Debug-only sanity checks for the first-drink detection rule.
    /// Invoked from CrowdPromptView_Previews so the assertions run whenever
    /// previews render, without requiring an XCTest target.
    static func runCrowdDetectionAssertions() {
        assert(
            Self.shouldPromptForCrowd(priorDrinkCount: 0, tentId: "t1"),
            "First drink with a tent should prompt"
        )
        assert(
            !Self.shouldPromptForCrowd(priorDrinkCount: 0, tentId: nil),
            "First drink without a tent should not prompt"
        )
        assert(
            !Self.shouldPromptForCrowd(priorDrinkCount: 3, tentId: "t1"),
            "Subsequent drink should not prompt"
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
