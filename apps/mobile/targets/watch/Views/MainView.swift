import SwiftUI
import WatchKit

struct MainView: View {
    @StateObject private var viewModel = AppViewModel()
    @State private var showingDrinkPicker = false
    @State private var showingTentPicker = false

    var body: some View {
        ScrollView {
            VStack(spacing: 8) {
                Button {
                    showingTentPicker = true
                } label: {
                    HStack(spacing: 4) {
                        Text(viewModel.currentTent.tentName)
                            .font(.footnote)
                            .foregroundStyle(.secondary)
                            .lineLimit(1)
                        Image(systemName: "chevron.right")
                            .font(.caption2)
                            .foregroundStyle(.secondary)
                    }
                }
                .buttonStyle(.plain)

                Button {
                    Task {
                        await viewModel.logDrink(.beer)
                        if viewModel.status == .success {
                            WKInterfaceDevice.current().play(.success)
                        }
                    }
                } label: {
                    HStack(spacing: 4) {
                        Text(verbatim: "🍺")
                        Text(verbatim: "Prost!")
                    }
                    .font(.title3.bold())
                    .frame(maxWidth: .infinity, minHeight: 44)
                }
                .buttonStyle(.borderedProminent)
                .disabled(
                    viewModel.status == .logging ||
                    viewModel.status == .noSession ||
                    viewModel.status == .noFestival
                )

                Button(String(localized: "watch.drink.other")) {
                    showingDrinkPicker = true
                }
                .font(.footnote)
                .buttonStyle(.plain)
                .foregroundStyle(.blue)

                Text(todaySummary)
                    .font(.caption)
                    .foregroundStyle(.secondary)

                statusBanner
            }
            .padding(.horizontal, 6)
        }
        .sheet(isPresented: $showingDrinkPicker) {
            DrinkTypePickerView { type in
                showingDrinkPicker = false
                Task {
                    await viewModel.logDrink(type)
                    if viewModel.status == .success {
                        WKInterfaceDevice.current().play(.success)
                    }
                }
            }
        }
        .sheet(isPresented: $showingTentPicker) {
            TentPickerView(
                tents: viewModel.festivalTents,
                selectedTentId: viewModel.currentTent.tentId
            ) { tent in
                viewModel.changeTent(to: tent)
                showingTentPicker = false
            }
        }
        .sheet(
            isPresented: Binding(
                get: { viewModel.promptingCrowdForTentId != nil },
                set: { presented in
                    if !presented { viewModel.dismissCrowdPrompt() }
                }
            )
        ) {
            CrowdPromptView(
                tentName: viewModel.currentTent.tentName,
                onSubmit: { level in
                    Task {
                        await viewModel.submitCrowdReport(level: level)
                        WKInterfaceDevice.current().play(.success)
                    }
                },
                onSkip: { viewModel.dismissCrowdPrompt() }
            )
        }
        .task { await viewModel.bootstrap() }
    }

    private var todaySummary: String {
        let others = max(0, viewModel.drinkCount - viewModel.beerCount)
        if others == 0 {
            return String(
                format: NSLocalizedString(
                    "watch.today.count",
                    comment: "Today summary when only beers were logged. %lld is drink count."
                ),
                viewModel.drinkCount
            )
        }
        return String(
            format: NSLocalizedString(
                "watch.today.countMixed",
                comment: "Today summary with beers and other drinks. %1$lld is beers, %2$lld is others."
            ),
            viewModel.beerCount,
            others
        )
    }

    @ViewBuilder
    private var statusBanner: some View {
        switch viewModel.status {
        case .idle, .loading, .logging:
            EmptyView()
        case .success:
            Text(verbatim: "✓ Prost!")
                .font(.caption2)
                .foregroundStyle(.green)
                .task {
                    try? await Task.sleep(nanoseconds: 1_200_000_000)
                    viewModel.acknowledgeSuccess()
                }
        case .needsRetry:
            Text("watch.error.notSent")
                .font(.caption2)
                .foregroundStyle(.red)
        case .noSession:
            Text("watch.status.noSession")
                .font(.caption2)
                .foregroundStyle(.orange)
        case .noFestival:
            Text("watch.status.noFestival")
                .font(.caption2)
                .foregroundStyle(.orange)
        }
    }
}
