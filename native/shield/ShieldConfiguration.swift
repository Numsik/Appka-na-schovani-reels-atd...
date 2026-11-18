import ManagedSettings
import ManagedSettingsUI
import UIKit

final class ShieldConfigurationExtension: ShieldConfigurationDataSource {
    override func configuration(shielding application: Application) -> ShieldConfiguration {
        ShieldConfiguration(
            backgroundBlurStyle: .systemUltraThinMaterialDark,
            backgroundColor: UIColor(red: 0.05, green: 0.07, blue: 0.06, alpha: 1),
            icon: UIImage(systemName: "leaf.circle"),
            title: .init(text: "Reels mají pauzu.", color: .white),
            subtitle: .init(text: "Na chvíli odlož telefon. Po pauze máš čas přejít do zpráv. Pokud se Instagram neuvolní, otevři Reels filtr.", color: .lightGray),
            primaryButtonLabel: .init(text: "Zavřít Instagram", color: .black),
            primaryButtonBackgroundColor: UIColor(red: 0.76, green: 0.97, blue: 0.61, alpha: 1)
        )
    }
}
