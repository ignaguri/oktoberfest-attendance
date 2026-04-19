import SwiftUI
import WatchKit

struct MainView: View {
    @StateObject private var viewModel = AppViewModel()
    @State private var showingDrinkPicker = false

    var body: some View {
        ScrollView {
            VStack(spacing: 8) {
                Text(viewModel.currentTentName)
                    .font(.footnote)
                    .foregroundStyle(.secondary)

                Button {
                    Task {
                        await viewModel.logDrink(.beer)
                        WKInterfaceDevice.current().play(.success)
                    }
                } label: {
                    Label("Prost!", systemImage: "mug.fill")
                        .font(.title3.bold())
                        .frame(maxWidth: .infinity, minHeight: 44)
                }
                .buttonStyle(.borderedProminent)
                .disabled(
                    viewModel.status == .logging ||
                    viewModel.status == .noSession ||
                    viewModel.status == .noFestival
                )

                Button("Other drink…") {
                    showingDrinkPicker = true
                }
                .font(.footnote)
                .buttonStyle(.plain)
                .foregroundStyle(.blue)

                Text("Today: \(viewModel.drinkCount) 🍺")
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
                    WKInterfaceDevice.current().play(.success)
                }
            }
        }
        .task { await viewModel.bootstrap() }
    }

    @ViewBuilder
    private var statusBanner: some View {
        switch viewModel.status {
        case .idle, .loading, .logging:
            EmptyView()
        case .success:
            Text("✓ Prost!")
                .font(.caption2)
                .foregroundStyle(.green)
                .task {
                    try? await Task.sleep(nanoseconds: 1_200_000_000)
                    viewModel.acknowledgeSuccess()
                }
        case .needsRetry:
            Text("Not sent — tap Prost to retry")
                .font(.caption2)
                .foregroundStyle(.red)
        case .noSession:
            Text("Sign in on iPhone first")
                .font(.caption2)
                .foregroundStyle(.orange)
        case .noFestival:
            Text("Pick a festival on iPhone")
                .font(.caption2)
                .foregroundStyle(.orange)
        }
    }
}
