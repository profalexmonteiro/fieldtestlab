import { $, el, svgEl, signedSeconds, formatNumber } from "../dom.js";
import { t, getLang } from "../i18n.js";
import { cursorTime, jumpButton, pairContext, deviceName, deviceTag } from "./insight-common.js";
import { buildComparison } from "./compare.js";
import { buildRach } from "./rach.js";
import { buildHypotheses } from "./hypotheses.js";

const TABS = ["measure", "compare", "rach", "hypotheses"];
const dbm = (value) => `${formatNumber(value)} dBm`;
const ms = (value) => `${Math.round(value).toLocaleString(getLang(), { useGrouping: false })} ms`;

// "Measurement evidence" panel. It reads the traces derived from the logs
// (store.traces) and the current replay event; everything else is static
// per challenge. Full rebuilds happen only when the inputs change; replay
// ticks just move the cursor.
export function mountInsightView(actions) {
  const panel = $("#insight-panel");
  const tabs = $("#insight-tabs");
  const body = $("#insight-body");
  let lastKey = "";
  let update = () => {};
  let last = null;

  tabs.addEventListener("click", (event) => {
    const button = event.target.closest("[data-tab]");
    if (button) actions.onSetTab(button.dataset.tab);
  });
  tabs.addEventListener("keydown", (event) => {
    if (!["ArrowLeft", "ArrowRight"].includes(event.key)) return;
    const current = TABS.indexOf(event.target.dataset.tab);
    if (current < 0) return;
    const next = TABS[(current + (event.key === "ArrowRight" ? 1 : TABS.length - 1)) % TABS.length];
    actions.onSetTab(next);
    requestAnimationFrame(() => tabs.querySelector(`[data-tab="${next}"]`)?.focus());
  });
  body.addEventListener("click", (event) => {
    const jump = event.target.closest("[data-jump-scenario]");
    if (jump) {
      actions.onJump(jump.dataset.jumpScenario, Number(jump.dataset.jumpIdx || 0));
      return;
    }
    const action = event.target.closest("[data-action]")?.dataset.action;
    if (action === "reveal") actions.onToggleReveal();
  });
  body.addEventListener("change", (event) => {
    if (event.target.matches("[data-overlay]")) actions.onToggleOverlay(event.target.checked);
    if (event.target.matches("[data-hypothesis]")) actions.onMarkHypothesis(event.target.dataset.hypothesis, event.target.checked);
  });
  new ResizeObserver(() => last && render(...last)).observe(panel);

  function render(state, challenge, scenario) {
    last = [state, challenge, scenario];
    const config = challenge.insights;
    panel.hidden = !config;
    if (!config) {
      lastKey = "";
      return;
    }
    const traces = state.traces?.challengeId === challenge.id ? state.traces : null;
    const width = Math.round(body.getBoundingClientRect().width);
    const key = [challenge.id, scenario.id, getLang(), state.insightTab, state.overlay, state.revealed,
      JSON.stringify(state.hypothesisMarks), traces?.byScenario ? "ready" : traces?.error || "loading", width].join("|");

    if (key !== lastKey) {
      lastKey = key;
      tabs.replaceChildren(...TABS.map((tab) => el("button", {
        type: "button",
        role: "tab",
        className: "insight-tab",
        "data-tab": tab,
        "aria-selected": String(tab === state.insightTab),
        tabIndex: tab === state.insightTab ? 0 : -1
      }, t(`insight.tab.${tab}`))));
      update = () => {};
      if (!traces?.byScenario && state.insightTab !== "hypotheses") {
        body.replaceChildren(el("p", { className: "insight-empty" }, traces?.error ? t("insight.error", { error: traces.error }) : t("insight.loading")));
      } else {
        const ctx = { state, challenge, scenario, config, traces: traces?.byScenario, width, onJump: actions.onJump };
        const built = state.insightTab === "compare" ? buildComparison(ctx)
          : state.insightTab === "rach" ? buildRach(ctx)
            : state.insightTab === "hypotheses" ? buildHypotheses(ctx)
              : buildMeasure(ctx);
        body.replaceChildren(built.node);
        update = built.update || update;
      }
    }
    update(state, scenario);
  }

  return render;
}

let clipCounter = 0;

// Tab 1: RSRP of both layers against the A5 thresholds, filtered BLER
// against Qout, the T310/T304 timers and the n41 measurement cadence.
function buildMeasure(ctx) {
  const { config, state } = ctx;
  const pair = pairContext(ctx);
  const { focus, other } = pair;
  const showOther = state.overlay;
  const a5 = config.a5;

  const W = Math.max(300, ctx.width);
  const left = 46;
  const right = 10;
  const compact = W < 560;
  const xMin = -300;
  const xMax = Math.max(...[focus.trace, other.trace].map((trace) =>
    trace.serviceBack?.t ?? trace.milestones.rlf?.t ?? 1000)) + 250;
  const x = (time) => left + (time - xMin) / (xMax - xMin) * (W - left - right);
  const inWindow = (sample) => sample.t >= xMin && sample.t <= xMax;

  // Numbered milestone badges sit above the plot, in as many rows as needed
  // to keep neighbouring badges apart.
  const marks = milestoneList(focus.trace, config);
  const rowEnds = [];
  const markRows = marks.map((mark) => {
    const mx = x(mark.t);
    let row = rowEnds.findIndex((end) => mx - end >= 19);
    if (row < 0) row = rowEnds.length;
    rowEnds[row] = mx;
    return row;
  });

  const rsrpTop = 14 + Math.max(2, rowEnds.length) * 19 + 2;
  const rsrpH = compact ? 150 : 170;
  const blerTop = rsrpTop + rsrpH + 20;
  const blerH = 46;
  const timerTop = blerTop + blerH + 18;
  const timerH = 12;
  const cadTop = timerTop + timerH + 20;
  const cadRow = 20;
  const axisY = cadTop + cadRow * 2 + 4;
  const H = axisY + 22;

  const values = [focus.trace, ...(showOther ? [other.trace] : [])]
    .flatMap((trace) => [...trace.serving, ...trace.target].filter(inWindow).map((sample) => sample.value))
    .concat([a5.threshold1 - a5.hysteresis, a5.threshold2 + a5.hysteresis, ...(state.revealed && a5.apparentThreshold2 ? [a5.apparentThreshold2] : [])].filter(Number.isFinite));
  const yLow = Math.floor((Math.min(...values) - 2) / 4) * 4;
  const yHigh = Math.ceil((Math.max(...values) + 2) / 4) * 4;
  const y = (value) => rsrpTop + (yHigh - value) / (yHigh - yLow) * rsrpH;
  const blerMax = Math.max(16, Math.ceil(Math.max(focus.trace.maxBler, other.trace.maxBler) + 1));
  const yb = (value) => blerTop + (blerMax - value) / blerMax * blerH;

  const svg = svgEl("svg", { class: "measure-chart", viewBox: `0 0 ${W} ${H}`, width: W, height: H, role: "img",
    "aria-label": t("chart.aria", { device: deviceName(focus.scenario) }) });
  const add = (parent, name, attributes, text) => {
    const node = svgEl(name, attributes);
    if (text !== undefined) node.textContent = text;
    parent.append(node);
    return node;
  };
  const clipId = `played-${++clipCounter}`;
  const defs = add(svg, "defs", {});
  const clip = add(add(defs, "clipPath", { id: clipId }), "rect", { x: 0, y: 0, width: W, height: H });

  // Grid and axes.
  const grid = add(svg, "g", { class: "chart-grid" });
  for (let value = yLow; value <= yHigh; value += 4) {
    add(grid, "line", { x1: left, x2: W - right, y1: y(value), y2: y(value) });
    add(grid, "text", { x: left - 6, y: y(value) + 3, "text-anchor": "end", class: "chart-tick" }, formatNumber(value));
  }
  add(grid, "text", { x: 4, y: rsrpTop - 8, class: "chart-unit" }, "RSRP (dBm)");
  add(grid, "line", { x1: left, x2: W - right, y1: yb(0), y2: yb(0) });
  add(grid, "text", { x: 4, y: blerTop - 6, class: "chart-unit" }, t("chart.bler"));
  add(grid, "text", { x: left - 6, y: yb(0) + 3, "text-anchor": "end", class: "chart-tick" }, "0 %");
  add(grid, "text", { x: 4, y: timerTop + timerH - 2, class: "chart-unit" }, t("chart.timers"));
  add(grid, "text", { x: 4, y: cadTop - 6, class: "chart-unit" }, t("chart.cadence", { band: config.target.band }));
  const step = (xMax - xMin) / 1000 > 3 ? 500 : 250;
  for (let time = 0; time <= xMax; time += step) {
    if (compact && time % 1000 !== 0) continue;
    add(grid, "line", { x1: x(time), x2: x(time), y1: rsrpTop, y2: axisY, class: time === 0 ? "chart-zero" : "chart-vgrid" });
    add(grid, "text", { x: x(time), y: axisY + 14, "text-anchor": "middle", class: "chart-tick" },
      time === 0 ? "T 0" : `+${(time / 1000).toLocaleString(getLang())} s`);
  }

  // A5 windows of the focus trace: TTT, then any delay beyond it.
  const m = focus.trace.milestones;
  if (m.a5Met) {
    const tttEnd = m.a5Met.t + a5.tttMs;
    add(svg, "rect", { x: x(m.a5Met.t), y: rsrpTop, width: x(tttEnd) - x(m.a5Met.t), height: rsrpH, class: "chart-band ttt" });
    const reportAt = m.report ? m.report.t : (m.rlf ? m.rlf.t : xMax);
    if (reportAt - tttEnd > 200) {
      add(svg, "rect", { x: x(tttEnd), y: rsrpTop, width: x(reportAt) - x(tttEnd), height: rsrpH, class: "chart-band late" });
      if (x(reportAt) - x(tttEnd) > 120) {
        add(svg, "text", { x: (x(tttEnd) + x(reportAt)) / 2, y: rsrpTop + rsrpH - 8, "text-anchor": "middle", class: "chart-band-label" },
          t("chart.lateBand", { late: (Math.round((reportAt - tttEnd) / 10) / 100).toLocaleString(getLang()) }));
      }
    }
  }

  // Thresholds.
  const threshold = (value, cls, label, yPos = y(value)) => {
    add(svg, "line", { x1: left, x2: W - right, y1: yPos, y2: yPos, class: `chart-threshold ${cls}` });
    add(svg, "text", { x: W - right - 4, y: yPos - 4, "text-anchor": "end", class: `chart-threshold-label ${cls}` }, label);
  };
  // Narrow charts keep only the level; the legend below names the lines.
  const thLabel = (key, value, th) => compact
    ? `${formatNumber(value)} dBm`
    : t(key, { value: formatNumber(value), th: formatNumber(th), hys: formatNumber(a5.hysteresis) });
  threshold(a5.threshold1 - a5.hysteresis, "serving", thLabel("chart.thServing", a5.threshold1 - a5.hysteresis, a5.threshold1));
  threshold(a5.threshold2 + a5.hysteresis, "target", thLabel("chart.thTarget", a5.threshold2 + a5.hysteresis, a5.threshold2));
  if (state.revealed && Number.isFinite(a5.apparentThreshold2)) {
    threshold(a5.apparentThreshold2, "apparent", compact ? `≈ ${formatNumber(a5.apparentThreshold2)} dBm` : t("chart.thApparent", { value: formatNumber(a5.apparentThreshold2) }));
  }
  threshold(config.rlm.outOfSyncBler, "bler", t("chart.qout", { value: config.rlm.outOfSyncBler }), yb(config.rlm.outOfSyncBler));

  const path = (samples, scale) => samples.filter(inWindow)
    .map((sample, index) => `${index ? "L" : "M"} ${x(sample.t).toFixed(1)} ${scale(sample.value).toFixed(1)}`).join(" ");
  const series = (parent, trace, cls, dots) => {
    const group = add(parent, "g", { class: cls });
    add(group, "path", { d: path(trace.serving, y), class: "chart-line serving" });
    add(group, "path", { d: path(trace.target, y), class: "chart-line target" });
    add(group, "path", { d: path(trace.bler, yb), class: "chart-line bler" });
    if (!dots) return group;
    for (const [samples, scale, kind, unit] of [[trace.serving, y, "serving", " dBm"], [trace.target, y, "target", " dBm"], [trace.bler, yb, "bler", " %"]]) {
      for (const sample of samples.filter(inWindow)) {
        const dot = add(group, "circle", { cx: x(sample.t), cy: scale(sample.value), r: kind === "target" ? 3.4 : 2.4, class: `chart-dot ${kind}` });
        add(dot, "title", {}, `#${sample.idx} · T ${signedSeconds(sample.t)} · ${formatNumber(sample.value)}${unit}`);
      }
    }
    return group;
  };
  if (showOther) series(svg, other.trace, "chart-series other", true);
  const future = series(svg, focus.trace, "chart-series focus future", false);
  const played = series(svg, focus.trace, "chart-series focus", true);
  played.setAttribute("clip-path", `url(#${clipId})`);

  // Timers: T310 (inferred start) and T304 of the focus trace.
  const timers = add(svg, "g", { class: "chart-timers" });
  let t310Fill = null;
  if (m.t310Start) {
    const end = m.t310Start.t + config.rlm.t310Ms;
    add(timers, "rect", { x: x(m.t310Start.t), y: timerTop, width: x(end) - x(m.t310Start.t), height: timerH, rx: 3, class: "chart-timer-track t310" });
    t310Fill = add(timers, "rect", { x: x(m.t310Start.t), y: timerTop, width: x(end) - x(m.t310Start.t), height: timerH, rx: 3, class: "chart-timer t310" });
    add(timers, "text", { x: x(m.t310Start.t) + 5, y: timerTop + timerH - 3, class: "chart-timer-label" }, t("chart.t310", { total: ms(config.rlm.t310Ms) }));
  }
  if (m.hoCommand && m.hoComplete) {
    add(timers, "rect", { x: x(m.hoCommand.t), y: timerTop, width: Math.max(3, x(m.hoComplete.t) - x(m.hoCommand.t)), height: timerH, rx: 3, class: "chart-timer t304" });
    add(timers, "text", { x: x(m.hoComplete.t) + 5, y: timerTop + timerH - 3, class: "chart-timer-label" }, t("chart.t304", { left: ms(focus.trace.t304RemainingMs) }));
  }

  // Cadence: one tick per measurement gap (MGRP) and one dot per n41 update.
  [pair.dut, pair.cdut].forEach((device, row) => {
    const top = cadTop + row * cadRow;
    const trace = device.trace;
    const gapsEnd = trace.milestones.hoCommand?.t ?? trace.milestones.rlf?.t ?? trace.milestones.report?.t ?? 0;
    const group = add(svg, "g", { class: `chart-cadence${device.id === focus.id ? " focus" : ""}` });
    add(group, "text", { x: left - 6, y: top + 12, "text-anchor": "end", class: "chart-tick strong" }, deviceTag(device.scenario));
    add(group, "line", { x1: x(0), x2: x(gapsEnd), y1: top + 9, y2: top + 9, class: "chart-cadence-base" });
    for (let time = 0; time <= gapsEnd; time += config.gap.mgrpMs) {
      add(group, "line", { x1: x(time), x2: x(time), y1: top + 6, y2: top + 12, class: "chart-gap" });
    }
    for (const sample of trace.cadence.samples) {
      const tick = add(group, "rect", { x: x(sample.t) - 2, y: top + 1, width: 4, height: 16, rx: 1.5, class: "chart-measure" });
      add(tick, "title", {}, `#${sample.idx} · T ${signedSeconds(sample.t)} · PCI ${config.target.pci} ${dbm(sample.value)}`);
    }
  });

  // Numbered milestones of the focus trace.
  const markLayer = add(svg, "g", { class: "chart-marks" });
  marks.forEach((mark, index) => {
    const mx = x(mark.t);
    const cy = 14 + markRows[index] * 19;
    add(markLayer, "line", { x1: mx, x2: mx, y1: cy + 8, y2: axisY, class: `chart-mark-line ${mark.tone}` });
    const badge = add(markLayer, "g", { class: `chart-mark ${mark.tone}` });
    add(badge, "circle", { cx: mx, cy, r: 8.5 });
    add(badge, "text", { x: mx, y: cy + 3.5, "text-anchor": "middle" }, String(index + 1));
    add(badge, "title", {}, `${index + 1}. ${mark.label} · T ${signedSeconds(mark.t)}`);
  });

  const cursor = add(svg, "line", { x1: 0, x2: 0, y1: rsrpTop - 4, y2: axisY, class: "chart-cursor", visibility: "hidden" });

  // Clicking the chart jumps the replay to the nearest event of the focus log.
  svg.addEventListener("click", (event) => {
    const box = svg.getBoundingClientRect();
    const time = xMin + ((event.clientX - box.left) * (W / box.width) - left) / (W - left - right) * (xMax - xMin);
    const candidates = [...focus.trace.serving, ...focus.trace.target, ...focus.trace.bler, ...marks.filter((mark) => mark.idx)];
    const nearest = candidates.reduce((best, item) => Math.abs(item.t - time) < Math.abs(best.t - time) ? item : best, candidates[0]);
    if (nearest) ctx.onJump(focus.id, nearest.idx);
  });

  const legend = el("div", { className: "chart-legend" },
    legendItem("serving", t("chart.legend.serving", { label: config.labels.serving })),
    legendItem("target", t("chart.legend.target", { label: config.labels.target })),
    legendItem("bler", "OOS_FILT_BLER"),
    legendItem("measure", t("chart.legend.measure", { band: config.target.band })),
    showOther ? legendItem("other", t("chart.legend.other", { device: deviceName(other.scenario) })) : null);

  const head = el("div", { className: "insight-head" },
    el("div", {},
      el("strong", { className: "insight-focus" }, t("chart.focus", { device: deviceName(focus.scenario), tag: deviceTag(focus.scenario) })),
      el("span", { className: "insight-sub" }, t("chart.subtitle"))),
    el("label", { className: "insight-check" },
      el("input", { type: "checkbox", "data-overlay": "", ...(showOther ? { checked: "" } : {}) }),
      t("chart.overlay", { device: deviceName(other.scenario) })));

  const node = el("div", { className: "insight-measure" },
    head,
    ctx.config.pair.includes(ctx.scenario.id) ? null : el("p", { className: "insight-note" }, config.focusNote),
    el("div", { className: "chart-wrap" }, svg),
    legend,
    el("ol", { className: "chart-marklist" }, marks.map((mark, index) => el("li", {},
      jumpButton(focus.id, mark.idx, [
        el("span", { className: "chart-markno" }, String(index + 1)),
        el("span", {}, mark.label),
        el("small", {}, `T ${signedSeconds(mark.t)}`)
      ], `chart-markitem ${mark.tone}`)))),
    factsGrid(pair, config));

  return {
    node,
    update(state, scenario) {
      const time = cursorTime(state, scenario, focus.id);
      const visible = time !== null && time >= xMin && time <= xMax;
      cursor.setAttribute("visibility", visible ? "visible" : "hidden");
      future.setAttribute("visibility", time === null ? "hidden" : "visible");
      const cx = time === null ? W : Math.max(left, Math.min(W, x(time)));
      clip.setAttribute("width", String(cx));
      if (visible) {
        cursor.setAttribute("x1", String(cx));
        cursor.setAttribute("x2", String(cx));
      }
      if (t310Fill) {
        const start = m.t310Start.t;
        const end = Math.min(time === null ? Infinity : time, m.t310Start.t + config.rlm.t310Ms);
        t310Fill.setAttribute("width", String(Math.max(0, x(end) - x(start))));
      }
    }
  };
}

function legendItem(kind, label) {
  return el("span", { className: `chart-legend-item ${kind}` }, el("i"), label);
}

export function milestoneList(trace, config) {
  const m = trace.milestones;
  const lateReport = m.report && m.a5Met && m.report.t - m.a5Met.t - config.a5.tttMs > 200;
  return [
    m.measConfig && { ...m.measConfig, key: "measConfig", tone: "accent" },
    m.a5Met && { ...m.a5Met, key: "a5Met", tone: "warn" },
    m.a5Met && { t: m.a5Met.t + config.a5.tttMs, idx: m.a5Met.idx, key: "ttt", tone: "warn" },
    m.oosCross && { ...m.oosCross, key: "oos", tone: "bad" },
    m.t310Start && { ...m.t310Start, key: "t310", tone: "bad" },
    m.report && { ...m.report, key: "report", tone: lateReport ? "bad" : "good" },
    m.hoCommand && { ...m.hoCommand, key: "hoCommand", tone: "accent" },
    m.hoComplete && { ...m.hoComplete, key: "hoComplete", tone: "good" },
    m.rlf && { ...m.rlf, key: "rlf", tone: "bad" },
    m.reestComplete && { ...m.reestComplete, key: "reest", tone: "warn" }
  ].filter(Boolean)
    .map((mark) => ({ ...mark, label: t(`mark.${mark.key}`, { ttt: ms(config.a5.tttMs) }) }))
    .sort((a, b) => a.t - b.t);
}

// Measured facts, side by side for DUT and CDUT. Evidence only: no verdicts.
function factsGrid(pair, config) {
  const rows = [pair.dut, pair.cdut];
  const fact = (title, note, value) => el("div", { className: "fact" },
    el("div", { className: "fact-title" }, title),
    rows.map((device) => el("div", { className: "fact-row" },
      el("span", { className: "fact-device" }, deviceName(device.scenario)),
      el("strong", {}, value(device.trace)))),
    note ? el("div", { className: "fact-note" }, note) : null);

  const dutFirst = pair.dut.trace.firstGapTarget;
  const cdutFirst = pair.cdut.trace.firstGapTarget;
  const firstDelta = dutFirst && cdutFirst ? dutFirst.value - cdutFirst.value : NaN;
  return el("div", { className: "facts" },
    fact(t("fact.cadence", { band: config.target.band }), t("fact.cadenceNote", { mgrp: config.gap.mgrpMs, mgl: config.gap.mglMs }), (trace) =>
      t("fact.cadenceValue", {
        median: ms(trace.cadence.medianMs),
        range: trace.cadence.minMs === trace.cadence.maxMs ? ms(trace.cadence.minMs) : `${Math.round(trace.cadence.minMs)}–${ms(trace.cadence.maxMs)}`,
        gaps: Math.round(trace.cadence.gapsPerSample)
      })),
    fact(t("fact.firstGap", { band: config.target.band }),
      Number.isFinite(firstDelta) ? t("fact.firstGapNote", { delta: `${firstDelta > 0 ? "+" : ""}${formatNumber(firstDelta)}` }) : "",
      (trace) => t("fact.firstGapValue", {
        gap: trace.firstGapTarget ? dbm(trace.firstGapTarget.value) : "—",
        idle: trace.idleTarget ? dbm(trace.idleTarget.value) : "—"
      })),
    fact(t("fact.a5"), t("fact.a5Note", { ttt: ms(config.a5.tttMs) }), (trace) => {
      const m = trace.milestones;
      if (!m.a5Met) return "—";
      return m.report
        ? t("fact.a5Value", { met: signedSeconds(m.a5Met.t), report: signedSeconds(m.report.t), wait: ms(m.report.t - m.a5Met.t) })
        : t("fact.a5NoReport", { met: signedSeconds(m.a5Met.t) });
    }),
    fact(t("fact.t310"), t("fact.t310Note"), (trace) => {
      const m = trace.milestones;
      if (!m.rlf) return t("fact.t310Never", { max: trace.maxBler.toLocaleString(getLang()) });
      return m.report ? t("fact.t310Margin", { left: ms(m.rlf.t - m.report.t) }) : t("fact.t310NoReport");
    }));
}
