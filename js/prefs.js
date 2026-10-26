// Per-viewer preferences (theme, language). Storage can be unavailable
// (private mode, blocked site data), so every access is guarded.
const KEY = "fieldlab.prefs";

export function loadPrefs() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) || {};
  } catch {
    return {};
  }
}

export function savePrefs(patch) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...loadPrefs(), ...patch }));
  } catch {
    // Preference simply won't persist.
  }
}
