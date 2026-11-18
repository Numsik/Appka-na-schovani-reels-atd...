import ExpoModulesCore
import FamilyControls
import ReplayKit
import SwiftUI

public class ReelsGuardModule: Module {
    public func definition() -> ModuleDefinition {
        Name("ReelsGuard")

        Function("getState") { self.state() }

        AsyncFunction("requestAuthorization") { (promise: Promise) in
            guard GuardStore.open() != nil else { promise.reject("UNAVAILABLE", "Tato verze nemá aktivované blokování."); return }
            Task { @MainActor in
                do {
                    try await AuthorizationCenter.shared.requestAuthorization(for: .individual)
                    promise.resolve(self.state())
                } catch {
                    promise.reject("AUTHORIZATION", "Přístup k Času u obrazovky nebyl povolen. Zkus ho povolit v Nastavení.")
                }
            }
        }

        AsyncFunction("selectInstagram") { (promise: Promise) in
            guard let store = GuardStore.open(), AuthorizationCenter.shared.authorizationStatus == .approved else {
                promise.reject("AUTHORIZATION", "Nejdřív povol Čas u obrazovky."); return
            }
            guard let presenter = self.appContext?.utilities?.currentViewController(), presenter.presentedViewController == nil else {
                promise.reject("PRESENTATION", "Nejdřív zavři otevřené okno a zkus to znovu."); return
            }
            var controller: UIViewController?
            let picker = InstagramPicker(initial: store.selection ?? FamilyActivitySelection()) { selection in
                if let selection {
                    store.enabled = false
                    store.removeShield()
                    store.selection = selection
                }
                controller?.dismiss(animated: true) { promise.resolve(self.state()) }
                controller = nil
            }
            controller = UIHostingController(rootView: picker)
            controller?.isModalInPresentation = true
            presenter.present(controller!, animated: true)
        }.runOnQueue(.main)

        AsyncFunction("setEnabled") { (enabled: Bool) -> [String: Any] in
            guard let store = GuardStore.open() else { throw GuardError.unavailable }
            if enabled {
                guard AuthorizationCenter.shared.authorizationStatus == .approved else { throw GuardError.permission }
                guard let selection = store.selection, selection.applicationTokens.count == 1,
                      selection.categoryTokens.isEmpty, selection.webDomainTokens.isEmpty else { throw GuardError.selection }
            }
            store.enabled = enabled
            if !enabled { store.removeShield() }
            return self.state()
        }

        View(ReelsBroadcastView.self) {}
    }

    private func state() -> [String: Any] {
        let store = GuardStore.open()
        store?.refresh()
        let authorization: String
        switch AuthorizationCenter.shared.authorizationStatus {
        case .approved: authorization = "approved"
        case .denied: authorization = "denied"
        default: authorization = "notDetermined"
        }
        if authorization != "approved" { store?.removeShield() }
        return [
            "available": store != nil,
            "authorization": authorization,
            "selectedAppCount": store?.selection?.applicationTokens.count ?? 0,
            "enabled": store?.enabled ?? false,
            "broadcasting": store?.broadcasting ?? false,
            "blockedUntil": (store?.blockedUntil ?? 0) * 1000,
            "lastDetectionAt": (store?.lastDetectionAt ?? 0) * 1000,
        ]
    }
}

private enum GuardError: LocalizedError {
    case unavailable, permission, selection
    var errorDescription: String? {
        switch self {
        case .unavailable: return "Tato verze nemá aktivované blokování."
        case .permission: return "Nejdřív povol Čas u obrazovky."
        case .selection: return "Vyber pouze jednu aplikaci: Instagram."
        }
    }
}

private struct InstagramPicker: View {
    @State var selection: FamilyActivitySelection
    let finish: (FamilyActivitySelection?) -> Void
    init(initial: FamilyActivitySelection, finish: @escaping (FamilyActivitySelection?) -> Void) {
        _selection = State(initialValue: initial)
        self.finish = finish
    }
    var body: some View {
        NavigationStack {
            VStack {
                Text("Vyber pouze Instagram. Nevybírej kategorie ani weby.")
                    .font(.callout).padding()
                FamilyActivityPicker(selection: $selection)
            }
            .navigationTitle("Vyber Instagram")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Zrušit") { finish(nil) } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Hotovo") { finish(selection) }
                        .disabled(selection.applicationTokens.count != 1 || !selection.categoryTokens.isEmpty || !selection.webDomainTokens.isEmpty)
                }
            }
        }
    }
}

final class ReelsBroadcastView: ExpoView {
    private let picker = RPSystemBroadcastPickerView(frame: .zero)
    required init(appContext: AppContext? = nil) {
        super.init(appContext: appContext)
        picker.preferredExtension = (Bundle.main.bundleIdentifier ?? "cz.numsik.reelsfiltr") + ".broadcast"
        picker.showsMicrophoneButton = false
        picker.tintColor = UIColor(red: 0.76, green: 0.97, blue: 0.61, alpha: 1)
        addSubview(picker)
    }
    override func layoutSubviews() {
        super.layoutSubviews()
        picker.frame = bounds
    }
}
