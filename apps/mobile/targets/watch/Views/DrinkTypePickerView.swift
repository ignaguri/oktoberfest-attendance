import SwiftUI

struct DrinkTypePickerView: View {
    let onPick: (AppViewModel.DrinkType) -> Void

    private var nonDefaultTypes: [AppViewModel.DrinkType] {
        AppViewModel.DrinkType.allCases.filter { $0 != .beer }
    }

    var body: some View {
        // Wrapped in NavigationStack so `.navigationTitle` renders when the
        // view is presented via `.sheet` in MainView (sheets are a new
        // navigation context and need their own stack).
        NavigationStack {
            ScrollView {
                VStack(spacing: 6) {
                    ForEach(nonDefaultTypes) { type in
                        Button {
                            onPick(type)
                        } label: {
                            HStack {
                                Text(type.emoji)
                                Text(type.label).font(.footnote)
                                Spacer()
                            }
                            .frame(maxWidth: .infinity, minHeight: 40)
                        }
                        .buttonStyle(.bordered)
                    }
                }
                .padding(.horizontal, 6)
            }
            .navigationTitle("Drink")
        }
    }
}
