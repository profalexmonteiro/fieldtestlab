import { loadScenarioEvents } from "./data.js";
import { analyzeEvents } from "./analyzer.js";
import { t, getLang } from "./i18n.js";

const IDLE_GAP_MS = 2000;
const COMPRESSED_GAP_MS = 1500;

export const initialReplay = {
  status: "idle", // idle | loading | ready | error
  events: [],
  index: -1,
  playing: false,
  failed: false,
  message: ""
};

// Replay engine: owns the timer and the async log load, and publishes its
// state in store.replay. It never touches the DOM.
// `getStops(events)` returns the event indices where guided mode pauses.
export function createReplay(store, { getSpeed, getStops = () => new Set() }) {
  let scenario = null;
  let timer = null;
  let loadAbort = null;

  const replay = () => store.get().replay;
  const update = (patch) => store.set((state) => ({ replay: { ...state.replay, ...patch } }));
  const lastIndex = () => replay().events.length - 1;

  function clearTimer() {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  }

  function pause(message) {
    clearTimer();
    update(message === undefined ? { playing: false } : { playing: false, message });
  }

  function reset(nextScenario) {
    clearTimer();
    loadAbort?.abort();
    loadAbort = null;
    scenario = nextScenario;
    update({
      ...initialReplay,
      message: scenario.logPath
        ? t("replay.idleLog", { path: scenario.logPath })
        : t(scenario.stepsTimed ? "replay.idleStepsTimed" : "replay.idleSteps")
    });
  }

  // Loads events on first use. Returns false if the scenario changed meanwhile.
  async function ensureLoaded() {
    if (replay().events.length) return true;
    const owner = scenario;
    loadAbort = new AbortController();
    update({ status: "loading", message: t("replay.loading") });
    try {
      const events = analyzeEvents(await loadScenarioEvents(owner, loadAbort.signal));
      if (owner !== scenario) return false;
      update({ status: "ready", events, failed: false });
      return true;
    } catch (error) {
      if (owner !== scenario || error.name === "AbortError") return false;
      update({ status: "error" });
      throw error;
    } finally {
      if (owner === scenario) loadAbort = null;
    }
  }

  function scheduleNext() {
    const { events, index } = replay();
    if (index >= events.length - 1) {
      pause();
      return;
    }
    const sourceDelay = Math.max(0, (events[index + 1].replayTimeMs || 0) - (events[index].replayTimeMs || 0));
    // Long idle stretches in a log (e.g. 41 s of stable session before the
    // degradation) are compressed so the replay doesn't look frozen.
    const compressed = sourceDelay > IDLE_GAP_MS;
    const delay = compressed
      ? COMPRESSED_GAP_MS
      : Math.max(scenario.logPath ? 40 : 120, sourceDelay) / getSpeed().value;
    if (compressed) {
      update({ message: t("replay.gap", { gap: (sourceDelay / 1000).toLocaleString(getLang(), { maximumFractionDigits: 1 }) }) });
    }
    timer = setTimeout(() => {
      timer = null;
      const next = replay().index + 1;
      if (next >= lastIndex()) {
        update({ index: next, playing: false, message: t("replay.doneHint") });
        return;
      }
      if (getStops(replay().events).has(next)) {
        update({ index: next, playing: false, message: t("replay.guideStop", { index: next + 1, total: replay().events.length }) });
        return;
      }
      update(compressed ? { index: next, message: playingMessage() } : { index: next });
      scheduleNext();
    }, delay);
  }

  async function toggle() {
    if (replay().playing) {
      pause(t("replay.paused", { index: replay().index + 1, total: replay().events.length }));
      return;
    }
    try {
      if (!(await ensureLoaded())) return;
    } catch (error) {
      update({ failed: true, message: t("replay.error", { error: error.message }) });
      console.error("Falha ao carregar reprodução de referência.", error);
      return;
    }
    const total = replay().events.length;
    let index = replay().index;
    if (index >= total - 1) index = -1;
    if (index < 0) index = 0;
    const playing = index < total - 1;
    update({ index, playing, message: playing ? playingMessage() : t("replay.done") });
    if (playing) scheduleNext();
  }

  function playingMessage() {
    return scenario.logPath ? t("replay.playingLog", { speed: getSpeed().label }) : t(scenario.stepsTimed ? "replay.playingStepsTimed" : "replay.playingSteps");
  }

  async function step(direction) {
    pause();
    try {
      if (!(await ensureLoaded())) return;
    } catch (error) {
      update({ message: t("replay.stepError", { error: error.message }) });
      console.error("Falha ao avançar reprodução.", error);
      return;
    }
    const index = Math.max(0, Math.min(lastIndex(), replay().index + direction));
    update({ index, message: t("replay.stepped", { index: index + 1, total: replay().events.length }) });
  }

  function seek(index) {
    clearTimer();
    update({ index, playing: false, message: t("replay.paused", { index: index + 1, total: replay().events.length }) });
  }

  // Loads the log if needed and pauses on the event with log number `idx`.
  async function jumpTo(idx) {
    pause();
    try {
      if (!(await ensureLoaded())) return;
    } catch (error) {
      update({ message: t("replay.stepError", { error: error.message }) });
      return;
    }
    const index = replay().events.findIndex((event) => Number(event.idx) === Number(idx));
    if (index >= 0) seek(index);
  }

  function restart() {
    clearTimer();
    update({
      index: -1,
      playing: false,
      message: scenario.logPath
        ? t("replay.restartLog", { path: scenario.logPath })
        : t("replay.restartSteps")
    });
  }

  return { reset, toggle, step, seek, jumpTo, restart };
}
