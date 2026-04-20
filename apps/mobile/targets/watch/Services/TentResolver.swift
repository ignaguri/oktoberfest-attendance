import Foundation

/// The resolved source of the current tent selection.
enum TentSource {
    case attendance
    case gps
    case manualOverride
    case none
}

/// Result of resolving the active tent.
struct ResolvedTent {
    let tentId: String?
    let tentName: String
    let source: TentSource
}

/// Resolves which tent to use, following the priority chain:
///   1. First tentId from today's attendance (user already checked in on phone)
///   2. Nearest tent from GPS (server pre-sorts by distance)
///   3. None (tentId = nil, name = "—")
enum TentResolver {

    static func resolve(
        attendance: AttendanceByDate?,
        nearbyTents: [NearbyTent]
    ) -> ResolvedTent {
        // 1. Attendance tent — user already picked one via the phone app.
        if let tentId = attendance?.tentIds.first, !tentId.isEmpty {
            // Prefer the name from tentVisits (always present when tentIds is), then nearby, then fallback.
            let visitName: String? = attendance?.tentVisits.first { $0.tentId == tentId }?.tentName
            let nearbyName: String? = nearbyTents.first { $0.tentId == tentId }?.tentName
            let name: String = visitName ?? nearbyName ?? "—"
            return ResolvedTent(tentId: tentId, tentName: name, source: .attendance)
        }

        // 2. GPS-nearest tent (server pre-sorts by distance, so first = nearest)
        if let nearest = nearbyTents.first {
            return ResolvedTent(tentId: nearest.tentId, tentName: nearest.tentName, source: .gps)
        }

        // 3. Nothing available
        return ResolvedTent(tentId: nil, tentName: "—", source: .none)
    }
}

#if DEBUG
import SwiftUI

extension TentResolver {
    /// Runs the canonical test scenarios at preview-render time.
    /// No XCTest target exists in the @bacons/apple-targets watch scaffold,
    /// so assertions ride along with SwiftUI previews.
    static func runAssertions() {
        let tentA = NearbyTent(tentId: "tent-a", tentName: "Hofbräu", category: nil,
                               latitude: 48.1, longitude: 11.5, distanceMeters: 10, beerPrice: 14.0)
        let tentB = NearbyTent(tentId: "tent-b", tentName: "Paulaner", category: nil,
                               latitude: 48.1, longitude: 11.5, distanceMeters: 50, beerPrice: 13.5)
        let nearby = [tentA, tentB]

        // 1. Attendance tent wins over GPS (name comes from tentVisits)
        let attendance = AttendanceByDate(id: "a1", date: "2026-04-19", festivalId: "f1",
                                          drinkCount: 2, beerCount: 2, tentIds: ["tent-b"],
                                          tentVisits: [TentVisit(tentId: "tent-b", tentName: "Paulaner")])
        let r1 = resolve(attendance: attendance, nearbyTents: nearby)
        assert(r1.tentId == "tent-b", "Test 1 failed: expected tent-b (attendance), got \(r1.tentId ?? "nil")")
        assert(r1.tentName == "Paulaner", "Test 1 name failed: expected Paulaner, got \(r1.tentName)")
        assert(r1.source == .attendance, "Test 1 source failed")

        // 2. GPS-nearest when no attendance
        let r2 = resolve(attendance: nil, nearbyTents: nearby)
        assert(r2.tentId == "tent-a", "Test 2 failed: expected tent-a (nearest), got \(r2.tentId ?? "nil")")
        assert(r2.source == .gps, "Test 2 source failed")

        // 3. Empty → none
        let r3 = resolve(attendance: nil, nearbyTents: [])
        assert(r3.tentId == nil, "Test 3 failed: expected nil")
        assert(r3.source == .none, "Test 3 source failed")

        // 4. Attendance tent with no matching visit and no nearby → name="—" but keeps ID
        let orphanAttendance = AttendanceByDate(id: "a2", date: "2026-04-19", festivalId: "f1",
                                                drinkCount: 1, beerCount: 1, tentIds: ["tent-z"], tentVisits: [])
        let r4 = resolve(attendance: orphanAttendance, nearbyTents: nearby)
        assert(r4.tentId == "tent-z", "Test 4 failed: expected tent-z, got \(r4.tentId ?? "nil")")
        assert(r4.tentName == "—", "Test 4 name failed: expected —, got \(r4.tentName)")
        assert(r4.source == .attendance, "Test 4 source failed")

        print("[TentResolver] All debug assertions passed ✓")
    }
}

struct TentResolver_Previews: PreviewProvider {
    static var previews: some View {
        let _ = TentResolver.runAssertions()
        return Text("TentResolver assertions OK")
            .font(.footnote)
    }
}
#endif
