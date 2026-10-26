import { $ } from "./dom.js";
import { createStore } from "./store.js";
import { loadCatalog, findChallenge, findScenario } from "./data.js";
import { createReplay, initialReplay } from "./replay.js";
import { t, setLang, getLang, translateDocument } from "./i18n.js";
import { loadPrefs, savePrefs } from "./prefs.js";
import { mountScenarioView } from "./views/scenario.js";
import { mountPlaybackView, getSelectedSpeed } from "./views/playback.js";
import { mountDashboardView } from "./views/dashboard.js";
import { mountSignalingView } from "./views/signaling.js";
import { mountSceneView } from "./views/scene.js";
import { mountModals } from "./views/modals.js";

function mountThemeToggle() {
  const button = $("#theme-toggle");
  const sync = () => {
    const dark = document.documentElement.dataset.theme === "dark";
    const label = t(dark ? "theme.toLight" : "theme.toDark");
    button.textContent = dark ? "☀" : "☾";
    button.setAttribute("aria-label", label);
    button.title = label;
    button.setAttribute("aria-pressed", String(dark));
  };
  button.addEventListener("click", () => {
    const theme = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = theme;
    savePrefs({ theme });
    sync();
  });
  return sync;
}

function mountLanguageSwitch(onChange) {
  const group = $("#lang-switch");
  const sync = () => group.querySelectorAll("[data-lang]").forEach((button) => {
    button.setAttribute("aria-pressed", String(button.dataset.lang === getLang()));
  });
  group.addEventListener("click", (event) => {
    const button = event.target.closest("[data-lang]");
    if (button && button.dataset.lang !== getLang()) onChange(button.dataset.lang);
  });
  return sync;
}

async function main() {
  setLang(loadPrefs().lang || "pt-BR");
  translateDocument();

  let catalog = await loadCatalog();
  const store = createStore({
    challengeId: catalog.defaults.challenge,
    scenarioId: catalog.defaults.scenario,
    replay: initialReplay
  });
  const current = (state = store.get()) => {
    const challenge = findChallenge(catalog, state.challengeId);
    return { challenge, scenario: findScenario(challenge, state.scenarioId) };
  };

  const replay = createReplay(store, { getSpeed: getSelectedSpeed });
  const selectScenario = (challengeId, scenarioId) => {
    store.set({ challengeId, scenarioId });
    replay.reset(current().scenario);
  };

  const renderScenario = mountScenarioView({
    onSelectChallenge: (id) => selectScenario(id, findChallenge(catalog, id).scenarios[0].id),
    onSelectScenario: (id) => selectScenario(store.get().challengeId, id)
  });
  const renderPlayback = mountPlaybackView({ replay });
  const renderDashboard = mountDashboardView();
  const renderSignaling = mountSignalingView();
  const renderScene = mountSceneView();
  const renderModals = mountModals({ getCurrent: () => current() });
  const syncTheme = mountThemeToggle();

  const renderStatic = () => {
    const { challenge, scenario } = current();
    renderScenario(catalog, challenge, scenario);
    renderModals(scenario);
    renderScene(scenario.scene);
  };

  const syncLanguage = mountLanguageSwitch(async (lang) => {
    setLang(lang);
    savePrefs({ lang });
    catalog = await loadCatalog();
    translateDocument();
    renderPlayback.translate();
    syncTheme();
    syncLanguage();
    renderStatic();
    // Case steps and procedure labels are language-specific, so reload the replay.
    replay.reset(current().scenario);
  });

  store.subscribe((state, previous) => {
    if (state.scenarioId !== previous.scenarioId || state.challengeId !== previous.challengeId) renderStatic();
    if (state.replay !== previous.replay) {
      const { challenge, scenario } = current(state);
      renderPlayback(state, scenario);
      renderDashboard(state, challenge, scenario);
      renderSignaling(state.replay.events[state.replay.index] || null, scenario);
    }
  });

  syncTheme();
  syncLanguage();
  renderStatic();
  replay.reset(current().scenario);
}

main().catch((error) => {
  console.error(error);
  $("#page-description").textContent = t("loadError", { error: error.message });
});
