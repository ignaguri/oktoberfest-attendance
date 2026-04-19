import Foundation

struct LogConsumptionRequest: Encodable {
    let festivalId: String
    let date: String            // yyyy-MM-dd
    let tentId: String?
    let drinkType: String       // "beer" | "radler" | "alcohol_free" | "wine" | "soft_drink" | "other"
    let pricePaidCents: Int     // required by server schema (send 0 when unknown)
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

    // POST /consumption — returns full AttendanceWithTotals
    func logConsumption(_ body: LogConsumptionRequest) async throws -> AttendanceWithTotals {
        try await post("consumption", body: body)
    }
}

// Slice 4 will add: fetchNearbyTents, fetchTodayReservations.
// Slice 5 will add: postCrowdReport.
