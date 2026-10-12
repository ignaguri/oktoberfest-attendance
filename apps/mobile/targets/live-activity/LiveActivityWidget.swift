import ActivityKit
import SwiftUI
import WidgetKit

@main
struct ProstCounterLiveActivityBundle: WidgetBundle {
    var body: some Widget {
        ProstLiveActivity()
    }
}

enum DrinkEmoji {
    /// Same mapping as drinkEmoji in packages/shared/src/utils/live-activity.ts.
    static func forType(_ type: String) -> String {
        switch type {
        case "beer": return "🍺"
        case "radler": return "🍋"
        case "alcohol_free": return "🚫"
        case "wine": return "🍷"
        case "soft_drink": return "🥤"
        default: return "🥂"
        }
    }
}

/// Same split as drinkBreakdown in packages/shared/src/utils/live-activity.ts.
struct CountLabel: View {
    let state: ProstActivityAttributes.ContentState

    var body: some View {
        let others = max(0, state.drinkCount - state.beerCount)
        HStack(alignment: .firstTextBaseline, spacing: 12) {
            if state.beerCount > 0 || others == 0 {
                HStack(spacing: 4) {
                    Text(verbatim: "🍺").font(.title2)
                    Text(verbatim: "\(state.beerCount)")
                        .font(.system(size: 34, weight: .bold))
                        .monospacedDigit()
                }
            }
            if others > 0 {
                HStack(spacing: 4) {
                    Text(verbatim: "🥂").font(.title3)
                    Text(verbatim: "\(others)")
                        .font(.system(size: 24, weight: .semibold))
                        .monospacedDigit()
                }
            }
        }
    }
}

struct DetailLines: View {
    let state: ProstActivityAttributes.ContentState
    let isStale: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            HStack(spacing: 4) {
                if let tentName = state.tentName {
                    Text(verbatim: "📍 \(tentName)")
                } else {
                    Text(verbatim: "📍 ") + Text("liveActivity.noTent")
                }
                if let lastLog = state.lastLogAt.flatMap(LiveActivityTap.parseDate) {
                    Text(verbatim: "·")
                    Text("liveActivity.lastActivity \(lastLog, style: .time)")
                }
            }
            .font(.caption)
            .foregroundStyle(.secondary)
            .lineLimit(1)

            if isStale {
                Text("liveActivity.paused").font(.caption).foregroundStyle(.secondary)
            } else if let code = state.message {
                // A String, not a literal: interpolating into LocalizedStringKey looks up "liveActivity.message.%@".
                Text(LocalizedStringKey("liveActivity.message." + code))
                    .font(.caption)
                    .foregroundStyle(.orange)
            }
        }
    }
}

struct LogButton: View {
    let state: ProstActivityAttributes.ContentState

    var body: some View {
        Button(intent: LogDrinkIntent()) {
            Text(verbatim: "+1 \(DrinkEmoji.forType(state.lastDrinkType))").font(.headline)
        }
        .buttonStyle(.borderedProminent)
        .tint(.orange)
    }
}

struct ProstLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: ProstActivityAttributes.self) { context in
            VStack(alignment: .leading, spacing: 6) {
                HStack {
                    Text(verbatim: context.attributes.festivalName).lineLimit(1)
                    Spacer()
                    Text(verbatim: "ProstCounter")
                }
                .font(.caption)
                .foregroundStyle(.secondary)
                HStack {
                    VStack(alignment: .leading, spacing: 4) {
                        CountLabel(state: context.state)
                        DetailLines(state: context.state, isStale: context.isStale)
                    }
                    Spacer()
                    if !context.isStale {
                        LogButton(state: context.state)
                    }
                }
            }
            .padding(16)
            .activityBackgroundTint(Color.black.opacity(0.85))
            .widgetURL(URL(string: "prostcounter://"))
        } dynamicIsland: { context in
            DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    CountLabel(state: context.state)
                }
                DynamicIslandExpandedRegion(.trailing) {
                    if !context.isStale {
                        LogButton(state: context.state)
                    }
                }
                DynamicIslandExpandedRegion(.bottom) {
                    DetailLines(state: context.state, isStale: context.isStale)
                }
            } compactLeading: {
                Text(verbatim: "🍺")
            } compactTrailing: {
                Text(verbatim: "\(context.state.drinkCount)").monospacedDigit()
            } minimal: {
                Text(verbatim: "\(context.state.drinkCount)").monospacedDigit()
            }
            .widgetURL(URL(string: "prostcounter://"))
        }
    }
}
