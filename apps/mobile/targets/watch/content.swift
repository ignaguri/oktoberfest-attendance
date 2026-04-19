import SwiftUI

struct ContentView: View {
    @State private var session: Session?
    @State private var tick = 0
    private let store = TokenStore()

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 6) {
                Text("ProstCounter Watch").font(.headline)
                if let s = session {
                    labeledRow("user", s.userId)
                    labeledRow("token", maskedToken(s.accessToken))
                    labeledRow("festival", s.currentFestivalId ?? "—")
                    labeledRow("expires", s.expiresAt.formatted(.dateTime.hour().minute().second()))
                    labeledRow("expired", store.isExpired ? "yes" : "no")
                } else {
                    Text("No session in App Group")
                        .font(.caption)
                        .foregroundStyle(.orange)
                }
                Button("Reload") {
                    tick += 1
                    session = store.read()
                }
                .buttonStyle(.bordered)
            }
            .padding(6)
        }
        .task(id: tick) { session = store.read() }
    }

    @ViewBuilder
    private func labeledRow(_ label: String, _ value: String) -> some View {
        HStack(alignment: .firstTextBaseline) {
            Text(label).font(.caption2).foregroundStyle(.secondary).frame(width: 52, alignment: .leading)
            Text(value).font(.caption2).lineLimit(2)
        }
    }

    private func maskedToken(_ t: String) -> String {
        guard t.count > 8 else { return t }
        return "\(t.prefix(8))…"
    }
}
