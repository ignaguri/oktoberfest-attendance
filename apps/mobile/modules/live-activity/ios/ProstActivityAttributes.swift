import ActivityKit
import Foundation

// Copy of targets/live-activity/_shared/ProstActivityAttributes.swift. This pod
// can't see the app target's types; ActivityKit matches the copies by name.
@available(iOS 17.0, *)
struct ProstActivityAttributes: ActivityAttributes {
    struct ContentState: Codable, Hashable {
        var drinkCount: Int
        var beerCount: Int
        var tentName: String?
        var lastDrinkType: String
        var lastTentId: String?
        var pendingCount: Int
        var lastLogAt: String
        var message: String?
    }

    var festivalId: String
    var festivalName: String
    var date: String
    var timezone: String
    var apiBaseUrl: String
}
