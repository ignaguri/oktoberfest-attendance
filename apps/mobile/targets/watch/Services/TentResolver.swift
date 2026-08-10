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
///   1. The tent of today's most recent visit (user already checked in on phone)
///   2. Nearest tent from GPS (server pre-sorts by distance)
///   3. None — surfaces a CTA label prompting the user to pick a tent.
enum TentResolver {

    /// Placeholder shown when no tent has been resolved yet. Acts as a CTA
    /// label on the tent-picker button so users know why it's tappable.
    /// Computed so it resolves against the current locale each time.
    static var noTentPlaceholder: String { String(localized: "watch.tent.select") }

    static func resolve(
        attendance: AttendanceByDate?,
        nearbyTents: [NearbyTent]
    ) -> ResolvedTent {
        // 1. Attendance tent — user already picked one via the phone app.
        //
        // The day's last visit, not tentIds.first. tentVisits is the full
        // sequence of visits in visit-time order (the API orders it ascending),
        // so its last element is the tent the user is in now. tentIds is a
        // deduplicated set in first-visit order, so on a day that went A, then
        // B, then back to A, its first entry is A only by luck and its last
        // entry is B, a tent already left. Reading either one attributes every
        // drink logged from the watch to the wrong tent.
        //
        // Falls back to tentIds only if tentVisits is empty, which the API does
        // not currently produce alongside a non-empty tentIds (both are built
        // from the same rows) — kept so a tent id is never dropped outright.
        let currentVisit = attendance?.tentVisits.last
        if let tentId = currentVisit?.tentId ?? attendance?.tentIds.last, !tentId.isEmpty {
            // Prefer the name carried by that visit, then nearby, then fallback.
            let visitName: String? = currentVisit?.tentName
            let nearbyName: String? = nearbyTents.first { $0.tentId == tentId }?.tentName
            let name: String = visitName ?? nearbyName ?? "—"
            return ResolvedTent(tentId: tentId, tentName: name, source: .attendance)
        }

        // 2. GPS-nearest tent (server pre-sorts by distance, so first = nearest)
        if let nearest = nearbyTents.first {
            return ResolvedTent(tentId: nearest.tentId, tentName: nearest.tentName, source: .gps)
        }

        // 3. Nothing available — user must tap to pick one.
        return ResolvedTent(tentId: nil, tentName: noTentPlaceholder, source: .none)
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

        // 5. Revisited tent — the day went B, then A, then back to B, so tentIds
        //    is [tent-b, tent-a] and its last entry names the tent already left.
        //    The resolver must follow the visit sequence and land on tent-b.
        let revisitAttendance = AttendanceByDate(id: "a3", date: "2026-04-19", festivalId: "f1",
                                                 drinkCount: 3, beerCount: 3,
                                                 tentIds: ["tent-b", "tent-a"],
                                                 tentVisits: [
                                                     TentVisit(tentId: "tent-b", tentName: "Paulaner"),
                                                     TentVisit(tentId: "tent-a", tentName: "Hofbräu"),
                                                     TentVisit(tentId: "tent-b", tentName: "Paulaner"),
                                                 ])
        let r5 = resolve(attendance: revisitAttendance, nearbyTents: nearby)
        assert(r5.tentId == "tent-b", "Test 5 failed: expected tent-b (latest visit), got \(r5.tentId ?? "nil")")
        assert(r5.tentName == "Paulaner", "Test 5 name failed: expected Paulaner, got \(r5.tentName)")
        assert(r5.source == .attendance, "Test 5 source failed")

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
