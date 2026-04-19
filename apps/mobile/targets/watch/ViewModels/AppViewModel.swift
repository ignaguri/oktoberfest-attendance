import CoreLocation
import Foundation
import SwiftUI
import WatchConnectivity

@MainActor
final class AppViewModel: ObservableObject {
    enum DrinkType: String, CaseIterable, Identifiable {
        case beer = "beer"
        case radler = "radler"
        case alcoholFree = "alcohol_free"
        case wine = "wine"
        case softDrink = "soft_drink"
        case other = "other"

        var id: String { rawValue }

        var label: String {
            switch self {
            case .beer: return "Beer"
            case .radler: return "Radler"
            case .alcoholFree: return "Alcohol-free"
            case .wine: return "Wine"
            case .softDrink: return "Soft drink"
            case .other: return "Other"
            }
        }

        var emoji: String {
            switch self {
            case .beer: return "🍺"
            case .radler: return "🍋"
            case .alcoholFree: return "🚫"
            case .wine: return "🍷"
            case .softDrink: return "🥤"
            case .other: return "✨"
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

    @Published private(set) var status: Status = .idle
    @Published private(set) var drinkCount: Int = 0
    @Published private(set) var currentTentId: String? = nil
    @Published private(set) var currentTentName: String = "—"
    @Published private(set) var festivalId: String? = nil
    // Derived from festivals.beerCost; used as pricePaidCents on log POST to satisfy
    // the server's price_paid_cents >= base_price_cents constraint. Defaults to
    // festival beer price so all drink types pass the check even without a
    // per-drink-type price resolver on the watch (MVP limitation).
    @Published private(set) var beerCostCents: Int = 0
    /// GPS-nearby tents fetched during bootstrap; used by TentPickerView.
    @Published private(set) var nearbyTents: [NearbyTent] = []

    private let api: APIClient
    private let tokenStore: TokenStore
    private let locationService: LocationService
    private let dateFormatter: DateFormatter

    init(api: APIClient = APIClient(), tokenStore: TokenStore = TokenStore(), locationService: LocationService = LocationService()) {
        self.api = api
        self.tokenStore = tokenStore
        self.locationService = locationService
        let f = DateFormatter()
        f.calendar = .init(identifier: .iso8601)
        f.locale = .init(identifier: "en_US_POSIX")
        f.dateFormat = "yyyy-MM-dd"
        f.timeZone = .current
        self.dateFormatter = f
    }

    var todayString: String { dateFormatter.string(from: Date()) }

    func bootstrap() async {
        // Skip if already loaded unless we need a retry.
        if festivalId != nil && status == .idle { return }
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

            let attendance = try await attendanceTask
            let festival = try await festivalTask

            if let a = attendance {
                drinkCount = a.drinkCount
            } else {
                drinkCount = 0
            }
            beerCostCents = Int(((festival.beerCost ?? 0) * 100).rounded())

            // Fetch nearby tents using GPS; non-fatal if location is denied or fails.
            var fetchedNearby: [NearbyTent] = []
            if let location = try? await locationService.currentLocation() {
                fetchedNearby = (try? await api.fetchNearbyTents(
                    latitude: location.coordinate.latitude,
                    longitude: location.coordinate.longitude,
                    festivalId: festId
                )) ?? []
            }
            nearbyTents = fetchedNearby

            // Priority: today's attendance tent (user checked in on phone) → GPS-nearest → none.
            let resolved = TentResolver.resolve(
                attendance: attendance,
                nearbyTents: fetchedNearby
            )
            currentTentId = resolved.tentId
            currentTentName = resolved.tentName

            status = .idle
        } catch APIError.noSession {
            status = .noSession
        } catch {
            status = .needsRetry
        }
    }

    func logDrink(_ type: DrinkType) async {
        if festivalId == nil {
            await bootstrap()
        }
        guard let festId = festivalId else {
            // bootstrap failed or no festival available — leave status as-is (noSession / noFestival / needsRetry).
            return
        }
        status = .logging

        let body = LogConsumptionRequest(
            festivalId: festId,
            date: todayString,
            tentId: currentTentId,
            drinkType: type.rawValue,
            pricePaidCents: beerCostCents
        )

        var attempts = 0
        var lastError: Error?
        while attempts < 3 {
            do {
                let result = try await api.logConsumption(body)
                drinkCount = result.drinkCount
                notifyIPhoneOfDrinkLog()
                status = .success
                return
            } catch {
                lastError = error
                attempts += 1
                if attempts < 3 {
                    let delayMs: UInt64 = attempts == 1 ? 500 : 2_000
                    try? await Task.sleep(nanoseconds: delayMs * 1_000_000)
                }
            }
        }
        print("logDrink failed after 3 attempts: \(String(describing: lastError))")
        status = .needsRetry
    }

    /// Manually override the active tent (called from TentPickerView).
    func changeTent(to tent: NearbyTent) {
        currentTentId = tent.tentId
        currentTentName = tent.tentName
    }

    func acknowledgeSuccess() {
        if status == .success { status = .idle }
    }

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
