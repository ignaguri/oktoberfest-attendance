import Foundation

enum APIError: Error {
    case unauthorized
    case network(Error)
    case decoding(Error)
    case httpStatus(Int, Data)
    case noSession
}

final class APIClient {
    static let baseURL: URL = {
        // Allow per-build overrides (e.g. a physical watch pointing at a
        // developer's LAN-accessible dev server) via the `WATCH_API_BASE_URL`
        // key injected into this target's Info.plist by withWatchInfoPlistEnv.
        // The value must already include the API version path (e.g. "/api/v1").
        if let override = Bundle.main.object(forInfoDictionaryKey: "WATCH_API_BASE_URL") as? String,
           !override.isEmpty,
           let url = URL(string: override) {
            return url
        }
        #if DEBUG
        return URL(string: "http://localhost:3008/api/v1")!
        #else
        return URL(string: "https://prostcounter.fun/api/v1")!
        #endif
    }()

    private let session: URLSession
    private let tokenStore: TokenStore
    private let decoder: JSONDecoder

    init(tokenStore: TokenStore = TokenStore(), session: URLSession = .shared) {
        self.session = session
        self.tokenStore = tokenStore
        let d = JSONDecoder()
        d.keyDecodingStrategy = .convertFromSnakeCase
        self.decoder = d
    }

    func get<T: Decodable>(_ path: String, query: [String: String] = [:]) async throws -> T {
        var components = URLComponents(url: Self.baseURL.appendingPathComponent(path), resolvingAgainstBaseURL: false)!
        if !query.isEmpty {
            components.queryItems = query.map { URLQueryItem(name: $0.key, value: $0.value) }
        }
        var request = URLRequest(url: components.url!)
        request.httpMethod = "GET"
        try authorize(&request)
        return try await send(request)
    }

    func post<T: Decodable, B: Encodable>(_ path: String, body: B) async throws -> T {
        var request = URLRequest(url: Self.baseURL.appendingPathComponent(path))
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONEncoder().encode(body)
        try authorize(&request)
        return try await send(request)
    }

    /// POST that discards the response body. Use for fire-and-forget endpoints
    /// where the server returns JSON we don't need (crowd reports, etc.).
    func postVoid<B: Encodable>(_ path: String, body: B) async throws {
        var request = URLRequest(url: Self.baseURL.appendingPathComponent(path))
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONEncoder().encode(body)
        try authorize(&request)
        try await sendVoid(request)
    }

    private func authorize(_ request: inout URLRequest) throws {
        guard let session = tokenStore.read() else { throw APIError.noSession }
        request.setValue("Bearer \(session.accessToken)", forHTTPHeaderField: "Authorization")
    }

    private func send<T: Decodable>(_ request: URLRequest) async throws -> T {
        let (data, response) = try await session.data(for: request)
        guard let http = response as? HTTPURLResponse else {
            throw APIError.network(URLError(.badServerResponse))
        }
        switch http.statusCode {
        case 200..<300:
            do { return try decoder.decode(T.self, from: data) }
            catch { throw APIError.decoding(error) }
        case 401:
            throw APIError.unauthorized
        default:
            throw APIError.httpStatus(http.statusCode, data)
        }
    }

    private func sendVoid(_ request: URLRequest) async throws {
        let (data, response) = try await session.data(for: request)
        guard let http = response as? HTTPURLResponse else {
            throw APIError.network(URLError(.badServerResponse))
        }
        switch http.statusCode {
        case 200..<300:
            return
        case 401:
            throw APIError.unauthorized
        default:
            throw APIError.httpStatus(http.statusCode, data)
        }
    }
}
