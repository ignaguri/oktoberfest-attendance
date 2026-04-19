import Foundation

struct Festival: Decodable, Identifiable {
    let id: String
    let name: String
    let startDate: String
    let endDate: String
    let beerCost: Double?   // EUR, e.g. 13.5 — used to derive pricePaidCents for drink logs
}

// Maps to AttendanceByDateSchema (extends AttendanceWithTotalsSchema).
// Server returns: { attendance: AttendanceByDate | null }
// keyDecodingStrategy = .convertFromSnakeCase handles snake_case → camelCase.
struct AttendanceByDate: Decodable {
    let id: String
    let date: String
    let festivalId: String
    let drinkCount: Int
    let tentIds: [String]            // flat array of tent UUIDs
    let tentVisits: [TentVisit]      // tent UUID + name — useful when GPS list doesn't include this tent
}

// Subset of server TentVisitSchema; enough for the watch to render the name.
struct TentVisit: Decodable {
    let tentId: String
    let tentName: String?
}

// Envelope wrapper for GET /attendance/by-date response.
struct AttendanceByDateResponse: Decodable {
    let attendance: AttendanceByDate?
}

// Maps to AttendanceWithTotalsSchema (what POST /consumption returns).
struct AttendanceWithTotals: Decodable {
    let id: String
    let drinkCount: Int
}

// Maps to GET /tents/nearby response.
// Server sends camelCase (tentId, tentName) so no CodingKeys renaming is needed;
// we use a distinct NearbyTent type rather than a generic Tent to make the
// distance field explicit and avoid confusion with plain Tent references elsewhere.
struct NearbyTent: Decodable, Identifiable {
    let tentId: String
    let tentName: String
    let category: String?
    let latitude: Double
    let longitude: Double
    let distanceMeters: Double
    let beerPrice: Double?

    var id: String { tentId }
}

// Envelope for GET /tents/nearby.
struct NearbyTentsResponse: Decodable {
    let tents: [NearbyTent]
}
