const { ipcRenderer } = require("electron");

function dismissMenuOverlay() {
  ipcRenderer.send("legalwork:menu-overlay:dismiss");
}

function focusBrowserContent() {
  dismissMenuOverlay();
  ipcRenderer.send("legalwork:browser:focus-content");
}

function installDismissListeners() {
  window.addEventListener("pointerdown", focusBrowserContent, { capture: true });
  window.addEventListener("wheel", dismissMenuOverlay, { capture: true, passive: true });
  window.addEventListener("keydown", dismissMenuOverlay, { capture: true });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", installDismissListeners, { once: true });
} else {
  installDismissListeners();
}
