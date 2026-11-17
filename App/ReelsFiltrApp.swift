import SwiftUI

@main
struct ReelsFiltrApp: App {
    var body: some Scene {
        WindowGroup {
            ScrollView {
                VStack(alignment: .leading, spacing: 28) {
                    VStack(alignment: .leading, spacing: 12) {
                        Image(systemName: "play.slash.fill")
                            .font(.system(size: 34, weight: .semibold))
                            .foregroundStyle(Color.accentColor)
                            .accessibilityHidden(true)

                        Text("Reels filtr")
                            .font(.largeTitle.bold())
                            .accessibilityAddTraits(.isHeader)

                        Text("Skryje odkazy na Reels a jejich přehrávač při používání Instagramu v Safari.")
                            .foregroundStyle(.secondary)
                    }

                    VStack(alignment: .leading, spacing: 16) {
                        Text("Zapnutí rozšíření")
                            .font(.headline)
                            .accessibilityAddTraits(.isHeader)

                        Text("V Nastavení vyhledej Safari, otevři Rozšíření a zapni Reels filtr.")
                        Text("V Safari otevři instagram.com a dovol rozšíření přístup k tomuto webu.")
                    }
                }
                .frame(maxWidth: 480, alignment: .leading)
                .padding(24)
                .frame(maxWidth: .infinity, alignment: .top)
            }
        }
    }
}
