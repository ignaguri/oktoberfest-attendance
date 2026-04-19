import Foundation
import SwiftUI

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

    private let api: APIClient
    private let tokenStore: TokenStore
    private let dateFormatter: DateFormatter

    init(api: APIClient = APIClient(), tokenStore: TokenStore = TokenStore()) {
        self.api = api
        self.tokenStore = tokenStore
        let f = DateFormatter()
        f.calendar = .init(identifier: .iso8601)
        f.locale = .init(identifier: "en_US_POSIX")
        f.dateFormat = "yyyy-MM-dd"
        f.timeZone = .current
        self.dateFormatter = f
    }

    var todayString: String { dateFormatter.string(from: Date()) }

    func bootstrap() async {
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
            let attendance = try await api.fetchTodayAttendance(
                festivalId: festId,
                isoDate: todayString
            )
            if let a = attendance {
                drinkCount = a.drinkCount
                currentTentId = a.tentIds.first
            } else {
                drinkCount = 0
            }
            status = .idle
        } catch APIError.noSession {
            status = .noSession
        } catch {
            status = .needsRetry
        }
    }

    func logDrink(_ type: DrinkType) async {
        guard let festId = festivalId else {
            status = .needsRetry
            return
        }
        status = .logging

        let body = LogConsumptionRequest(
            festivalId: festId,
            date: todayString,
            tentId: currentTentId,
            drinkType: type.rawValue,
            pricePaidCents: 0
        )

        var attempts = 0
        var lastError: Error?
        while attempts < 3 {
            do {
                _ = try await api.logConsumption(body)
                drinkCount += 1
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

    func acknowledgeSuccess() {
        if status == .success { status = .idle }
    }
}
