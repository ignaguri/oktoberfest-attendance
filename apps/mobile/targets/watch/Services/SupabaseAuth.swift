import Foundation
import os

private let log = Logger(subsystem: "com.prostcounter.watch", category: "auth")

enum SupabaseAuthError: Error {
    case missingConfig
    case network(Error)
    case httpStatus(Int)
    case decoding(Error)
}

/// Refreshes the Supabase access token directly from the watch using the
/// refresh token cached in the App Group. Without this the watch would be
/// stranded whenever the access token expires before the iPhone can push a
/// fresh session via WCSession.
///
/// Single-flight: concurrent API calls on an expired token funnel through
/// the same in-flight refresh task instead of both hitting /token.
actor SupabaseAuth {

    static let shared = SupabaseAuth()

    private var inflight: Task<Session, Error>?

    private var supabaseURL: URL? {
        guard
            let value = Bundle.main.object(forInfoDictionaryKey: "WATCH_SUPABASE_URL") as? String,
            !value.isEmpty,
            let url = URL(string: value)
        else { return nil }
        return url
    }

    private var anonKey: String? {
        guard
            let value = Bundle.main.object(forInfoDictionaryKey: "WATCH_SUPABASE_ANON_KEY") as? String,
            !value.isEmpty
        else { return nil }
        return value
    }

    /// Refresh the Supabase session using the stored refresh token. If another
    /// caller is already refreshing, awaits that same task.
    func refresh(using refreshToken: String) async throws -> Session {
        if let existing = inflight {
            return try await existing.value
        }
        let task = Task<Session, Error> { [weak self] in
            guard let self = self else { throw SupabaseAuthError.missingConfig }
            return try await self.performRefresh(refreshToken: refreshToken)
        }
        inflight = task
        defer { inflight = nil }
        return try await task.value
    }

    private func performRefresh(refreshToken: String) async throws -> Session {
        guard let baseURL = supabaseURL, let key = anonKey else {
            log.error("WATCH_SUPABASE_URL or WATCH_SUPABASE_ANON_KEY missing — cannot refresh")
            throw SupabaseAuthError.missingConfig
        }
        var components = URLComponents(url: baseURL.appendingPathComponent("auth/v1/token"), resolvingAgainstBaseURL: false)
        components?.queryItems = [URLQueryItem(name: "grant_type", value: "refresh_token")]
        guard let url = components?.url else {
            throw SupabaseAuthError.missingConfig
        }
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue(key, forHTTPHeaderField: "apikey")
        request.setValue("Bearer \(key)", forHTTPHeaderField: "Authorization")
        let body = RefreshRequest(refreshToken: refreshToken)
        request.httpBody = try JSONEncoder().encode(body)

        let (data, response): (Data, URLResponse)
        do {
            (data, response) = try await URLSession.shared.data(for: request)
        } catch {
            log.error("Refresh network error: \(error.localizedDescription, privacy: .public)")
            throw SupabaseAuthError.network(error)
        }
        guard let http = response as? HTTPURLResponse else {
            throw SupabaseAuthError.network(URLError(.badServerResponse))
        }
        guard (200..<300).contains(http.statusCode) else {
            log.error("Refresh HTTP \(http.statusCode, privacy: .public)")
            throw SupabaseAuthError.httpStatus(http.statusCode)
        }
        let decoder = JSONDecoder()
        decoder.keyDecodingStrategy = .convertFromSnakeCase
        let payload: RefreshResponse
        do {
            payload = try decoder.decode(RefreshResponse.self, from: data)
        } catch {
            log.error("Refresh decode error: \(error.localizedDescription, privacy: .public)")
            throw SupabaseAuthError.decoding(error)
        }
        let expiresAt: Date
        if let absolute = payload.expiresAt {
            expiresAt = Date(timeIntervalSince1970: absolute)
        } else if let relative = payload.expiresIn {
            expiresAt = Date(timeIntervalSinceNow: relative)
        } else {
            expiresAt = Date(timeIntervalSinceNow: 3600)
        }
        log.info("Refresh succeeded, new expiry: \(expiresAt, privacy: .public)")
        return Session(
            accessToken: payload.accessToken,
            refreshToken: payload.refreshToken,
            userId: payload.user.id,
            currentFestivalId: nil,
            expiresAt: expiresAt
        )
    }
}

// MARK: - Wire types

private struct RefreshRequest: Encodable {
    let refreshToken: String
}

private struct RefreshResponse: Decodable {
    let accessToken: String
    let refreshToken: String
    let expiresIn: TimeInterval?
    let expiresAt: TimeInterval?
    let user: User

    struct User: Decodable {
        let id: String
    }
}
