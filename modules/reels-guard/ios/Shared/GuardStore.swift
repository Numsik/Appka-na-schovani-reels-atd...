import Foundation
import FamilyControls
import ManagedSettings

final class GuardStore {
    static let shield = ManagedSettingsStore(named: .init("reelsfiltr"))
    let defaults: UserDefaults

    static func open() -> GuardStore? {
        guard Bundle.main.object(forInfoDictionaryKey: "ReelsNativeBlockingEnabled") as? Bool == true,
              let group = Bundle.main.object(forInfoDictionaryKey: "ReelsAppGroup") as? String,
              FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: group) != nil,
              let defaults = UserDefaults(suiteName: group) else { return nil }
        return GuardStore(defaults: defaults)
    }

    private init(defaults: UserDefaults) { self.defaults = defaults }

    var selection: FamilyActivitySelection? {
        get {
            guard let data = defaults.data(forKey: "selection") else { return nil }
            return try? JSONDecoder().decode(FamilyActivitySelection.self, from: data)
        }
        set {
            defaults.set(newValue.flatMap { try? JSONEncoder().encode($0) }, forKey: "selection")
            flush()
        }
    }

    var enabled: Bool {
        get { defaults.bool(forKey: "enabled") }
        set { defaults.set(newValue, forKey: "enabled"); flush() }
    }
    var broadcasting: Bool {
        get { defaults.bool(forKey: "broadcasting") }
        set { defaults.set(newValue, forKey: "broadcasting"); flush() }
    }
    var heartbeat: Double {
        get { defaults.double(forKey: "heartbeat") }
        set { defaults.set(newValue, forKey: "heartbeat"); flush() }
    }
    var blockedUntil: Double {
        get { defaults.double(forKey: "blockedUntil") }
        set { defaults.set(newValue, forKey: "blockedUntil"); flush() }
    }
    var graceUntil: Double {
        get { defaults.double(forKey: "graceUntil") }
        set { defaults.set(newValue, forKey: "graceUntil"); flush() }
    }
    var lastDetectionAt: Double {
        get { defaults.double(forKey: "lastDetectionAt") }
        set { defaults.set(newValue, forKey: "lastDetectionAt"); flush() }
    }

    func reload() { defaults.synchronize() }
    private func flush() { defaults.synchronize() }

    func removeShield() {
        Self.shield.clearAllSettings()
        blockedUntil = 0
    }

    func stopSession() {
        broadcasting = false
        heartbeat = 0
        graceUntil = 0
        removeShield()
    }

    func refresh(at now: Double = Date().timeIntervalSince1970) {
        reload()
        if broadcasting && now - heartbeat > 8 { stopSession() }
        if !enabled { removeShield() }
        if blockedUntil > 0 && now >= blockedUntil {
            removeShield()
            graceUntil = now + 8
        }
    }

    @discardableResult
    func block(at now: Double) -> Bool {
        guard enabled, broadcasting, blockedUntil == 0, now >= graceUntil,
              let selection, selection.applicationTokens.count == 1,
              selection.categoryTokens.isEmpty, selection.webDomainTokens.isEmpty else { return false }
        blockedUntil = now + 30
        lastDetectionAt = now
        Self.shield.shield.applications = selection.applicationTokens
        return true
    }
}
