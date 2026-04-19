import Foundation

struct LogConsumptionRequest: Encodable {
    let festivalId: String
    let date: String            // yyyy-MM-dd
    let tentId: String?
    let drinkType: String       // "beer" | "radler" | "alcohol_free" | "wine" | "soft_drink" | "other"
    let pricePaidCents: Int     // required by server; send festival.beerCost so paid >= server-derived base
}

extension APIClient {
    // GET /attendance/by-date?festivalId=...&date=...
    // Returns 200 with { attendance: null } when no attendance exists for the date.
    func fetchTodayAttendance(festivalId: String, isoDate: String) async throws -> AttendanceByDate? {
        let envelope: AttendanceByDateResponse = try await get(
            "attendance/by-date",
            query: ["festivalId": festivalId, "date": isoDate]
        )
        return envelope.attendance
    }

    // GET /festivals/{id}
    func fetchFestival(id: String) async throws -> Festival {
        try await get("festivals/\(id)")
    }

    // POST /consumption — returns full AttendanceWithTotals
    func logConsumption(_ body: LogConsumptionRequest) async throws -> AttendanceWithTotals {
        try await post("consumption", body: body)
    }

    // GET /tents/nearby?latitude=...&longitude=...&festivalId=...&radiusMeters=250
    // Server expects string-coerced query params (Zod coerce). Returns pre-sorted by distance.
    func fetchNearbyTents(latitude: Double, longitude: Double, festivalId: String) async throws -> [NearbyTent] {
        let envelope: NearbyTentsResponse = try await get(
            "tents/nearby",
            query: [
                "latitude": String(latitude),
                "longitude": String(longitude),
                "festivalId": festivalId,
                "radiusMeters": "250"
            ]
        )
        return envelope.tents
    }

}

// Slice 5 will add: postCrowdReport.
