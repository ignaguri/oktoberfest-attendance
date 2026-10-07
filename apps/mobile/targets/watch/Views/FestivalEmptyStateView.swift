import SwiftUI

/// Replaces the Prost! screen when there's no festival day to log against.
struct FestivalEmptyStateView: View {
    @ObservedObject var viewModel: AppViewModel

    var body: some View {
        VStack(spacing: 6) {
            Image(systemName: iconName)
                .font(.title2)
                .foregroundStyle(.orange)

            if viewModel.status != .noFestival, let name = viewModel.festival?.name {
                Text(verbatim: name)
                    .font(.headline)
                    .multilineTextAlignment(.center)
            }

            Text(message)
                .font(.footnote)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
        }
        .padding(.horizontal, 6)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private var iconName: String {
        switch viewModel.status {
        case .festivalEnded: return "flag.checkered"
        case .festivalNotStarted: return "calendar"
        default: return "iphone"
        }
    }

    private var message: String {
        switch viewModel.status {
        case .festivalEnded:
            return String(localized: "watch.festival.ended")
        case .festivalNotStarted:
            var style = Date.FormatStyle.dateTime.month(.abbreviated).day()
            style.timeZone = viewModel.festivalTimeZone
            let startDate = viewModel.festivalStartDate.map { $0.formatted(style) }
                ?? viewModel.festival?.startDate
                ?? ""
            return String(
                format: NSLocalizedString(
                    "watch.festival.startsOn",
                    comment: "Shown before the festival starts. %@ is the start date, e.g. Sep 19."
                ),
                startDate
            )
        default:
            return String(localized: "watch.status.noFestival")
        }
    }
}
