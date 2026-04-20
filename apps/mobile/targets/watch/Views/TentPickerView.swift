import SwiftUI

struct TentPickerView: View {
    let tents: [FestivalTent]
    let selectedTentId: String?
    let onPick: (FestivalTent) -> Void

    var body: some View {
        ScrollView {
            VStack(spacing: 6) {
                if tents.isEmpty {
                    Text("No tents for this festival")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                        .padding(.top, 16)
                } else {
                    ForEach(tents) { tent in
                        tentButton(tent, isSelected: tent.tentId == selectedTentId)
                    }
                }
            }
            .padding(.horizontal, 6)
        }
        .navigationTitle("Tent")
    }
}

extension TentPickerView {
    @ViewBuilder
    fileprivate func tentButton(_ tent: FestivalTent, isSelected: Bool) -> some View {
        let label = HStack {
            Text(tent.name)
                .font(.footnote)
                .lineLimit(1)
            Spacer()
            if isSelected {
                Image(systemName: "checkmark")
                    .font(.caption2)
            }
        }
        .frame(maxWidth: .infinity, minHeight: 40)

        if isSelected {
            Button { onPick(tent) } label: { label }
                .buttonStyle(.borderedProminent)
        } else {
            Button { onPick(tent) } label: { label }
                .buttonStyle(.bordered)
        }
    }
}
