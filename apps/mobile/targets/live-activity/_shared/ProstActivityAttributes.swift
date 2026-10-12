import ActivityKit
import Foundation

/// Mirrors LiveActivityStateSchema / LiveActivityAttributesSchema in
/// packages/shared/src/schemas/live-activity.schema.ts. A second copy lives in
/// modules/live-activity/ios: ActivityKit matches them by type name, so both
/// keep this exact name and these keys (content-state-drift.test.ts checks).
@available(iOS 17.0, *)
struct ProstActivityAttributes: ActivityAttributes {
    struct ContentState: Codable, Hashable {
        var drinkCount: Int
        var beerCount: Int
        var tentName: String?
        var lastDrinkType: String
        var lastTentId: String?
        var pendingCount: Int
        var lastLogAt: String?
        var message: String?
    }

    var festivalId: String
    var festivalName: String
    var date: String
    var timezone: String
    var apiBaseUrl: String
}
