import Foundation

struct Festival: Decodable, Identifiable {
    let id: String
    let name: String
    let startDate: String
    let endDate: String
}

// Maps to AttendanceByDateSchema (extends AttendanceWithTotalsSchema).
// Server returns: { attendance: AttendanceByDate | null }
// keyDecodingStrategy = .convertFromSnakeCase handles snake_case → camelCase.
struct AttendanceByDate: Decodable {
    let id: String
    let date: String
    let festivalId: String
    let drinkCount: Int
    let tentIds: [String]   // flat array of tent UUIDs from AttendanceByDateSchema
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
