import Foundation

struct LogConsumptionRequest: Encodable {
    let festivalId: String
    let date: String            // yyyy-MM-dd
    let tentId: String?
    let drinkType: AppViewModel.DrinkType
    // We send basePriceCents == pricePaidCents so the DB's `paid_gte_base` constraint
    // trivially holds regardless of drink type. Without an explicit base, the server
    // resolves it via tent → festival → default cascade, which can exceed the festival
    // beer price for types like radler/wine and break the insert.
    let basePriceCents: Int
    let pricePaidCents: Int
}

struct CrowdReportRequest: Encodable {
    let festivalId: String
    let crowdLevel: AppViewModel.CrowdLevel
}

/// Body for POST /attendance. `amount` is the legacy beer_count column —
/// kept at 0 because we track drinks via the consumptions table now. `tents`
/// REPLACES the day's tent list (server-side RPC diffs against current).
struct UpdateAttendanceRequest: Encodable {
    let festivalId: String
    let date: String
    let tents: [String]
    let amount: Int
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

    // POST /attendance — creates/updates the day's attendance, replacing the tent
    // list. Mirrors the phone's QuickAttendanceSheet save flow so the phone UI
    // reflects a watch-side tent pick on its next refetch. We discard the
    // response body (only need the 2xx).
    func updateAttendanceTents(festivalId: String, date: String, tentIds: [String]) async throws {
        try await postVoid(
            "attendance",
            body: UpdateAttendanceRequest(
                festivalId: festivalId,
                date: date,
                tents: tentIds,
                amount: 0
            )
        )
    }

    // GET /tents?festivalId=... — full tent roster for the festival (not
    // distance-filtered). Used by the tent picker.
    func fetchFestivalTents(festivalId: String) async throws -> [FestivalTent] {
        let envelope: FestivalTentsResponse = try await get(
            "tents",
            query: ["festivalId": festivalId]
        )
        return envelope.data
    }

    // GET /tents/nearby — server pre-sorts by distance.
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

    // POST /tents/{tentId}/crowd-report — body { festivalId, crowdLevel, waitTimeMinutes? }.
    // We ignore the response body (fire-and-forget on watch).
    func postCrowdReport(tentId: String, body: CrowdReportRequest) async throws {
        try await postVoid("tents/\(tentId)/crowd-report", body: body)
    }
}
