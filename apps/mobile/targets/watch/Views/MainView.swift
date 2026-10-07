import SwiftUI
import WatchKit

struct MainView: View {
    @StateObject private var viewModel = AppViewModel()
    @State private var showingDrinkPicker = false
    @State private var showingTentPicker = false
    @Environment(\.scenePhase) private var scenePhase

    var body: some View {
        Group {
            if viewModel.isOutsideFestival {
                FestivalEmptyStateView(viewModel: viewModel)
            } else {
                prostScreen
            }
        }
        .sheet(isPresented: $showingDrinkPicker) {
            DrinkTypePickerView { type in
                showingDrinkPicker = false
                Task { await logDrink(type) }
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
        .onChange(of: scenePhase) { _, phase in
            if phase == .active {
                Task { await viewModel.recheckOnForeground() }
            }
        }
        .onChange(of: viewModel.isOutsideFestival) { _, isOutside in
            if isOutside {
                showingDrinkPicker = false
                showingTentPicker = false
                viewModel.dismissCrowdPrompt()
            }
        }
    }

    private func logDrink(_ type: AppViewModel.DrinkType) async {
        await viewModel.logDrink(type)
        if viewModel.status == .success {
            WKInterfaceDevice.current().play(.success)
        } else if viewModel.isOutsideFestival {
            // The festival ended under an open app: the drink wasn't logged.
            WKInterfaceDevice.current().play(.failure)
        }
    }

    private var prostScreen: some View {
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
                    Task { await logDrink(.beer) }
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
                    viewModel.status == .noSession
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
    }

    private var todaySummary: String {
        let others = max(0, viewModel.drinkCount - viewModel.beerCount)
        if others == 0 {
            return String(
                format: NSLocalizedString(
                    "watch.today.count",
                    comment: "Today summary when only beers were logged. %lld is drink count."
                ),
                Int64(viewModel.drinkCount)
            )
        }
        return String(
            format: NSLocalizedString(
                "watch.today.countMixed",
                comment: "Today summary with beers and other drinks. %1$lld is beers, %2$lld is others."
            ),
            Int64(viewModel.beerCount),
            Int64(others)
        )
    }

    @ViewBuilder
    private var statusBanner: some View {
        switch viewModel.status {
        case .idle, .loading, .logging, .noFestival, .festivalNotStarted, .festivalEnded:
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
        }
    }
}
