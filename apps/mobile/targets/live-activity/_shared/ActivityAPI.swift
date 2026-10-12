import Foundation

@available(iOS 17.0, *)
enum ActivityAPIError: Error {
    case noSession
    case network
    case rejected(code: String?)
}

@available(iOS 17.0, *)
struct LogDrinkResponse: Decodable {
    struct Visit: Decodable {
        let visitDate: String
        let tentName: String?
    }

    let drinkCount: Int
    let beerCount: Int
    let tentVisits: [Visit]
}

/// The "+1" button's only network call. It never refreshes the Supabase
/// session: refresh tokens rotate, and a refresh here would leave the app
/// holding a stale one that trips Supabase's reuse detection.
@available(iOS 17.0, *)
enum ActivityAPI {
    static func logDrink(baseUrl: String, tap: PendingTap) async throws -> LogDrinkResponse {
        let defaults = UserDefaults(suiteName: PendingTapStore.appGroup)
        guard
            let token = defaults?.string(forKey: "accessToken"), !token.isEmpty,
            let expiresString = defaults?.string(forKey: "expiresAt"),
            let expiresAt = TimeInterval(expiresString),
            expiresAt - Date().timeIntervalSince1970 > 60,
            let url = URL(string: "\(baseUrl)/consumption")
        else { throw ActivityAPIError.noSession }

        var body: [String: Any] = [
            "festivalId": tap.festivalId,
            "date": tap.date,
            "drinkType": tap.drinkType,
            "consumptionId": tap.consumptionId,
            "recordedAt": tap.tappedAt,
        ]
        if let tentId = tap.tentId {
            body["tentId"] = tentId
        }

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.timeoutInterval = 10
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.httpBody = try JSONSerialization.data(withJSONObject: body)

        let data: Data
        let response: URLResponse
        do {
            (data, response) = try await URLSession.shared.data(for: request)
        } catch {
            throw ActivityAPIError.network
        }

        let status = (response as? HTTPURLResponse)?.statusCode ?? 0
        switch status {
        case 200..<300:
            return try JSONDecoder().decode(LogDrinkResponse.self, from: data)
        case 401:
            throw ActivityAPIError.noSession
        // 408/429 are transient: keep the tap pending. Any other 4xx will never succeed.
        case 408, 429:
            throw ActivityAPIError.network
        case 400..<500:
            let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
            let code = (json?["error"] as? [String: Any])?["code"] as? String
            throw ActivityAPIError.rejected(code: code)
        default:
            throw ActivityAPIError.network
        }
    }
}
