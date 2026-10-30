import { $ } from "./dom.js";
import { createStore } from "./store.js";
import { loadCatalog, loadLogFile, findChallenge, findScenario } from "./data.js";
import { buildTrace } from "./insights.js";
import { createReplay, initialReplay } from "./replay.js";
import { t, setLang, getLang, translateDocument } from "./i18n.js";
import { loadPrefs, savePrefs } from "./prefs.js";
import { mountScenarioView } from "./views/scenario.js";
import { mountPlaybackView, getSelectedSpeed } from "./views/playback.js";
import { mountDashboardView } from "./views/dashboard.js";
import { mountSignalingView } from "./views/signaling.js";
import { mountSceneView } from "./views/scene.js";
import { mountModals, openModal } from "./views/modals.js";
import { mountGlossary } from "./views/glossary.js";
import { mountRaceView } from "./views/race.js";
import { mountGuideView, guideStops } from "./views/guide.js";
import { mountInsightView } from "./views/insight.js";

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
  const prefs = loadPrefs();
  setLang(prefs.lang || "pt-BR");
  translateDocument();

  let catalog = await loadCatalog();
  const store = createStore({
    challengeId: catalog.defaults.challenge,
    scenarioId: catalog.defaults.scenario,
    replay: initialReplay,
    traces: null, // { challengeId, byScenario } — measurement evidence derived from the logs
    insightTab: "measure",
    overlay: true,
    guided: Boolean(prefs.guided),
    revealed: Boolean(prefs.revealed),
    hypothesisMarks: prefs.hypothesisMarks || {}
  });
  const current = (state = store.get()) => {
    const challenge = findChallenge(catalog, state.challengeId);
    return { challenge, scenario: findScenario(challenge, state.scenarioId) };
  };

  let stopsFor = null;
  let stops = new Set();
  const replay = createReplay(store, {
    getSpeed: getSelectedSpeed,
    getStops: (events) => {
      if (!store.get().guided) return new Set();
      if (stopsFor !== events) {
        stopsFor = events;
        stops = guideStops(current().scenario, events);
      }
      return stops;
    }
  });
  const selectScenario = (challengeId, scenarioId) => {
    store.set({ challengeId, scenarioId });
    replay.reset(current().scenario);
  };

  // Loads both logs of the challenge's DUT/CDUT pair once and derives their
  // measurement traces. Traces don't depend on the language.
  async function ensureTraces(challenge) {
    const config = challenge.insights;
    if (!config || store.get().traces?.challengeId === challenge.id) return;
    store.set({ traces: { challengeId: challenge.id, byScenario: null } });
    try {
      const traces = await Promise.all(config.pair.map(async (id) => {
        const scenario = findScenario(challenge, id);
        return [id, buildTrace(await loadLogFile(scenario.logPath, undefined, scenario.timeReference), config)];
      }));
      if (store.get().traces?.challengeId === challenge.id) store.set({ traces: { challengeId: challenge.id, byScenario: Object.fromEntries(traces) } });
    } catch (error) {
      console.error(error);
      if (store.get().traces?.challengeId === challenge.id) store.set({ traces: { challengeId: challenge.id, error: error.message } });
    }
  }

  // Jumps from evidence links and charts: opens the scenario and pauses on
  // log event `idx` (0 = just open the scenario), keeping the scene in view.
  const jumpTo = async (scenarioId, idx) => {
    const { challengeId } = store.get();
    if (scenarioId !== store.get().scenarioId) selectScenario(challengeId, scenarioId);
    if (idx > 0) await replay.jumpTo(idx);
    const scene = document.querySelector(".scene");
    const box = scene.getBoundingClientRect();
    if (box.top < 0 || box.bottom > window.innerHeight) scene.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "center" });
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
  const refreshGlossary = mountGlossary({ getChallenge: () => current().challenge, openModal });
  const renderRace = mountRaceView();
  const renderGuide = mountGuideView({
    onToggleGuided: (guided) => { store.set({ guided }); savePrefs({ guided }); },
    onJump: (idx) => replay.jumpTo(idx),
    onPlay: () => replay.toggle()
  });
  const renderInsight = mountInsightView({
    onJump: jumpTo,
    onSetTab: (insightTab) => store.set({ insightTab }),
    onToggleOverlay: (overlay) => store.set({ overlay }),
    onToggleReveal: () => {
      const revealed = !store.get().revealed;
      store.set({ revealed });
      savePrefs({ revealed });
    },
    onMarkHypothesis: (id, value) => {
      const hypothesisMarks = { ...store.get().hypothesisMarks, [id]: value };
      store.set({ hypothesisMarks });
      savePrefs({ hypothesisMarks });
    }
  });
  const syncTheme = mountThemeToggle();

  const renderStatic = () => {
    const { challenge, scenario } = current();
    renderScenario(catalog, challenge, scenario);
    renderModals(scenario);
    renderScene(scenario.scene, scenario.rightKind, scenario.coreNodes);
    ensureTraces(challenge);
    refreshGlossary();
  };
  // Always reads the latest state: ensureTraces may update the store while a
  // listener is still running.
  const renderEvidence = () => {
    const state = store.get();
    const { challenge, scenario } = current(state);
    renderInsight(state, challenge, scenario);
    renderRace(state, challenge, scenario);
    renderGuide(state, scenario);
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
    renderEvidence();
  });

  store.subscribe((state, previous) => {
    if (state.scenarioId !== previous.scenarioId || state.challengeId !== previous.challengeId) renderStatic();
    if (state.replay !== previous.replay) {
      const { challenge, scenario } = current(state);
      renderPlayback(state, scenario);
      renderDashboard(state, challenge, scenario);
      renderSignaling(state.replay.events[state.replay.index] || null, scenario);
    }
    renderEvidence();
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
