import Foundation

struct Festival: Decodable, Identifiable {
    let id: String
    let name: String
    let startDate: String
    let endDate: String
}
