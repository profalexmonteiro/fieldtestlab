import { el } from "../dom.js";

// Helpers shared by the tabs of the measurement evidence panel.
export const deviceTag = (scenario) => (scenario.device.split("/")[1] || scenario.device).trim();
export const deviceName = (scenario) => scenario.device.split("/")[0].trim();

// Time at the current replay event, if the replay is on `scenarioId`.
export function cursorTime(state, scenario, scenarioId) {
  if (scenario.id !== scenarioId) return null;
  const event = state.replay.events[state.replay.index];
  return event && Number.isFinite(event.refTimeMs) ? event.refTimeMs : null;
}

export const jumpButton = (scenarioId, idx, label, className = "insight-link") =>
  el("button", { type: "button", className, "data-jump-scenario": scenarioId, "data-jump-idx": idx || 0 }, label);

// The pair is [DUT, CDUT]; the focus is the scenario on screen when it is
// one of them, otherwise the DUT.
export function pairContext(ctx) {
  const [dutId, cdutId] = ctx.config.pair;
  const find = (id) => ctx.challenge.scenarios.find((item) => item.id === id);
  const focusId = ctx.config.pair.includes(ctx.scenario.id) ? ctx.scenario.id : dutId;
  const otherId = focusId === dutId ? cdutId : dutId;
  return {
    dut: { id: dutId, scenario: find(dutId), trace: ctx.traces[dutId] },
    cdut: { id: cdutId, scenario: find(cdutId), trace: ctx.traces[cdutId] },
    focus: { id: focusId, scenario: find(focusId), trace: ctx.traces[focusId] },
    other: { id: otherId, scenario: find(otherId), trace: ctx.traces[otherId] }
  };
}
