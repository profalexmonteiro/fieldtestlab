import { $, el, formatSeconds } from "../dom.js";
import { t } from "../i18n.js";

// Live KPI cards. Reads the precomputed `event.analysis`; no log parsing here.
export function mountDashboardView() {
  const root = $("#live-metrics");
  let previousValues = [];

  return function render(state, challenge, scenario) {
    const { events, index, playing } = state.replay;
    const event = index >= 0 ? events[index] : null;
    const total = events.length;
    if (!event) previousValues = [];

    const items = cardItems(event, index, total, challenge, scenario);
    root.replaceChildren(...items.map(([label, value, note, tone], itemIndex) => {
      const valueEl = el("div", { className: `live-metric-value ${tone || ""}`, title: value || "" }, value || "—");
      if (previousValues[itemIndex] !== undefined && previousValues[itemIndex] !== value) valueEl.classList.add("changed");
      return el("div", { className: "live-metric" },
        el("div", { className: "live-metric-label" }, label),
        valueEl,
        el("div", { className: "live-metric-note", title: note || "" }, note || ""));
    }));
    previousValues = items.map((item) => item[1]);

    const sourceIsLog = Boolean(scenario.logPath);
    const isDone = event && index === total - 1 && !playing;
    const status = $("#live-state");
    status.textContent = t(playing ? "kpi.state.playing" : isDone ? "kpi.state.done" : event ? "kpi.state.paused" : "kpi.state.idle");
    status.className = `live-state${playing ? " running" : isDone ? " done" : event ? " paused" : ""}`;
    $("#live-dashboard-subtitle").textContent = event
      ? `${t(sourceIsLog ? "kpi.sourceLog" : "kpi.sourceCase")} · ${event.msg || t("kpi.step")}`
      : t("live.subtitleIdle");
    $("#live-event-count").textContent = event ? t("kpi.events", { index: index + 1, total }) : t("kpi.noEvents");
    $("#live-event-time").textContent = !event
      ? `T+${formatSeconds(0)} s`
      : Number.isFinite(event.refTimeMs)
        ? `T ${signedSeconds(event.refTimeMs)}`
        : `${sourceIsLog ? "T+" : t("kpi.stepPrefix")} ${formatSeconds(elapsed(event))} s`;
    const percentage = total && event ? (index + 1) / total * 100 : 0;
    $("#live-event-progress").style.width = `${percentage}%`;
    $(".live-event-progress").setAttribute("aria-valuenow", String(Math.round(percentage)));
  };
}

const elapsed = (event) => Number.isFinite(event.replayTimeMs) ? event.replayTimeMs / 1000 : 0;
const signedSeconds = (ms) => `${ms < 0 ? "−" : "+"}${formatSeconds(Math.abs(ms) / 1000, 3)} s`;

// Time card. When the case measures from a reference (MeasConfig #2, or the
// start of degradation for timed case steps), show that clock so the replay
// reads the same numbers as the case document.
function timeItem(event, scenario) {
  const sourceIsLog = Boolean(scenario.logPath);
  if (event && Number.isFinite(event.refTimeMs)) {
    return [
      scenario.timeReference?.label || t("kpi.timeStep"),
      signedSeconds(event.refTimeMs),
      sourceIsLog ? event.ts : t("kpi.timeCase"),
      ""
    ];
  }
  return [
    scenario.timeReference?.label || t(sourceIsLog ? "kpi.timeLog" : "kpi.timeStep"),
    event ? `${formatSeconds(elapsed(event))} s` : "—",
    sourceIsLog ? (event?.ts || t("kpi.timeRelative")) : t(scenario.stepsTimed ? "kpi.timeCase" : "kpi.timeDidactic"),
    ""
  ];
}

function cardItems(event, index, total, challenge, scenario) {
  const sourceIsLog = Boolean(scenario.logPath);
  const a = event?.analysis;
  const isCase = Boolean(event?.aggregate);
  const identityPanel = challenge.cellPanel === "identity";

  const procedure = a ? a.procedure : t("kpi.waitingLog");
  const procedureNote = event
    ? `${event.rat || scenario.rat || ""} · ${event.protocol || (sourceIsLog ? "LOG" : t("case.protocol"))}`
    : t("kpi.startHint");

  let sequenceValue = a?.attempt
    ? `${t("kpi.attempt", { n: a.attempt })}${a.attemptMax ? ` / ${a.attemptMax}` : ""}`
    : event ? t("kpi.eventN", { index: index + 1, total }) : "—";
  let sequenceNote = event
    ? [event.protocol || t("kpi.event"), event.channel || ""].filter(Boolean).join(" · ")
    : t("kpi.waitingFirst");
  if (isCase) {
    sequenceValue = t("kpi.stepN", { index: index + 1, total });
    sequenceNote = t("kpi.caseSummary");
  }

  const plmn = a?.selectedPlmn || a?.suciPlmn;
  const pci = a?.pci || a?.latestPci;
  const cellValue = pci ? `PCI ${pci}` : identityPanel && plmn ? `PLMN ${plmn}` : "—";
  const cellDetail = !a ? "" : identityPanel
    ? [plmn ? `PLMN ${a.selectedPlmn || "—"} · SUCI ${a.suciPlmn || "—"}` : "", a.attempt ? t("kpi.attemptLower", { n: a.attempt }) : ""].filter(Boolean).join(" · ")
    : [a.measId ? `measId=${a.measId}` : "", a.signal].filter(Boolean).join(" · ");
  const cellNote = cellDetail || event?.cell
    || t(isCase ? "kpi.cellNoneCase" : event ? "kpi.cellNoneLog" : "kpi.cellWaiting");

  return [
    [t("kpi.procedure"), procedure, procedureNote, a?.tone || ""],
    [t("kpi.sequence"), sequenceValue, sequenceNote, a?.attempt && a.attemptMax > 1 ? "warn-text" : ""],
    [t(identityPanel ? "kpi.cellIdentity" : "kpi.cellMeasurement"), cellValue, cellNote, "accent-text"],
    timeItem(event, scenario)
  ];
}
