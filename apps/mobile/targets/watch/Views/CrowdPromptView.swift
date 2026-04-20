import SwiftUI

/// Asks the user how crowded the tent is right after their first drink of the day.
/// A bonus signal — Skip dismisses without posting, and any network failure inside
/// the submit path is swallowed silently (see AppViewModel.submitCrowdReport).
struct CrowdPromptView: View {
    let tentName: String
    let onSubmit: (AppViewModel.CrowdLevel) -> Void
    let onSkip: () -> Void

    var body: some View {
        ScrollView {
            VStack(spacing: 8) {
                Text("✓ Prost!")
                    .font(.caption)
                    .foregroundStyle(.green)
                Text("How crowded is \(tentName)?")
                    .font(.footnote)
                    .multilineTextAlignment(.center)

                ForEach(AppViewModel.CrowdLevel.allCases) { level in
                    Button {
                        onSubmit(level)
                    } label: {
                        Text(level.label)
                            .frame(maxWidth: .infinity, minHeight: 36)
                    }
                    .buttonStyle(.bordered)
                }

                Button("Skip") { onSkip() }
                    .buttonStyle(.plain)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            .padding(.horizontal, 6)
        }
    }
}

#if DEBUG
struct CrowdPromptView_Previews: PreviewProvider {
    static var previews: some View {
        // Exercise the first-drink detection assertions at preview-render time
        // so they run during DEBUG development without an XCTest target.
        let _ = AppViewModel.runCrowdDetectionAssertions()
        return CrowdPromptView(
            tentName: "Hofbräu",
            onSubmit: { _ in },
            onSkip: {}
        )
    }
}
#endif
