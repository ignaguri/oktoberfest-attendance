import SwiftUI

struct TentPickerView: View {
    let tents: [NearbyTent]
    let onPick: (NearbyTent) -> Void

    var body: some View {
        ScrollView {
            VStack(spacing: 6) {
                if tents.isEmpty {
                    Text("No nearby tents")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                        .padding(.top, 16)
                } else {
                    ForEach(tents) { tent in
                        Button {
                            onPick(tent)
                        } label: {
                            HStack {
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(tent.tentName)
                                        .font(.footnote)
                                        .lineLimit(1)
                                    Text("\(Int(tent.distanceMeters)) m")
                                        .font(.caption2)
                                        .foregroundStyle(.secondary)
                                }
                                Spacer()
                            }
                            .frame(maxWidth: .infinity, minHeight: 40)
                        }
                        .buttonStyle(.bordered)
                    }
                }
            }
            .padding(.horizontal, 6)
        }
        .navigationTitle("Tent")
    }
}
