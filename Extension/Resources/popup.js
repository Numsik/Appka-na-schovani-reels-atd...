(() => {
  "use strict";

  const storage = (globalThis.browser ?? globalThis.chrome).storage;
  const toggle = document.getElementById("enabled");
  const status = document.getElementById("status");
  let enabled = true;
  let settingsRevision = 0;

  function render(value) {
    enabled = value !== false;
    toggle.checked = enabled;
    status.textContent = enabled ? "Filtr je zapnutý." : "Filtr je vypnutý.";
  }

  storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "local" || !Object.hasOwn(changes, "enabled")) return;
    settingsRevision += 1;
    render(changes.enabled.newValue);
  });

  toggle.addEventListener("change", async () => {
    const requested = toggle.checked;
    const revisionAtSave = settingsRevision;
    toggle.disabled = true;
    status.textContent = "Ukládám…";
    try {
      await storage.local.set({ enabled: requested });
      if (settingsRevision === revisionAtSave) render(requested);
    } catch {
      toggle.checked = enabled;
      status.textContent = "Změnu se nepodařilo uložit. Zkus to znovu.";
    } finally {
      toggle.disabled = false;
    }
  });

  const revisionAtRead = settingsRevision;
  storage.local.get({ enabled: true }).then((settings) => {
    if (settingsRevision === revisionAtRead) render(settings.enabled);
    toggle.disabled = false;
  }).catch(() => {
    if (settingsRevision === revisionAtRead) {
      status.textContent = "Nastavení se nepodařilo načíst. Otevři nabídku znovu.";
    } else {
      toggle.disabled = false;
    }
  });
})();
