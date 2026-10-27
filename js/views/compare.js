import { el, signedSeconds } from "../dom.js";
import { t, getLang } from "../i18n.js";
import { pairContext, jumpButton, cursorTime } from "./insight-common.js";

const seconds = (ms, digits = 2) => `${(ms / 1000).toLocaleString(getLang(), { minimumFractionDigits: digits, maximumFractionDigits: digits })} s`;

// Tab 2: every scenario on one time axis, the computed differences of
// repetition 01, and the case table over the three repetitions.
export function buildComparison(ctx) {
  const { challenge, config } = ctx;
  const pair = pairContext(ctx);
  const comparison = challenge.comparison;
  const traceOf = (id) => ctx.traces[id];
  const axisMax = Math.max(...Object.values(ctx.traces).map((trace) => trace.serviceBack?.t ?? 0)) + 400;
  const pct = (ms) => `${Math.max(0, Math.min(100, ms / axisMax * 100))}%`;
  const cursors = [];

  const lane = (row) => {
    const scenario = challenge.scenarios.find((item) => item.id === row.scenario);
    const trace = traceOf(row.scenario);
    const track = el("div", { className: "lane-track" });
    if (trace) {
      const m = trace.milestones;
      const back = trace.serviceBack;
      track.append(el("span", { className: `lane-bar ${m.rlf ? "bad" : "good"}`, style: `left:0;width:${pct(back ? back.t : axisMax)}` }));
      if (m.a5Met && m.report) {
        track.append(el("span", { className: `lane-wait ${m.report.t - m.a5Met.t - config.a5.tttMs > 200 ? "bad" : "good"}`,
          style: `left:${pct(m.a5Met.t)};width:${pct(m.report.t - m.a5Met.t)}` }));
      }
      const marks = [
        [m.a5Met, "a5", t("mark.a5Met")],
        [m.report, "report", t("mark.report")],
        [m.hoComplete, "ho", t("mark.hoComplete")],
        [m.rlf, "rlf", t("mark.rlf")],
        [m.reestComplete, "reest", t("mark.reest")]
      ].filter(([mark]) => mark);
      for (const [mark, kind, label] of marks) {
        const button = jumpButton(row.scenario, mark.idx, el("span", { className: "sr-only" }, label), `lane-mark ${kind}`);
        button.style.left = pct(mark.t);
        button.title = `${label} · T ${signedSeconds(mark.t)} · #${mark.idx}`;
        track.append(button);
      }
      const cursor = el("span", { className: "lane-cursor", hidden: true });
      track.append(cursor);
      cursors.push([row.scenario, cursor]);
    } else if (scenario?.rows) {
      // No detailed log: the case sheet ranges (counted from the start of the degradation).
      for (const range of scenario.rows) {
        track.append(el("span", {
          className: `lane-range ${range.color === "failure" ? "bad" : "good"}`,
          style: `left:${pct(range.start * 1000)};width:${pct(Math.max(20, (range.end - range.start) * 1000))}`,
          title: `${range.label} · ${range.final}`
        }));
      }
    }
    return el("div", { className: `lane ${row.tone}` },
      jumpButton(row.scenario, 0, [el("strong", {}, row.label), el("small", {}, trace ? t("compare.fromLog") : t("compare.fromCase"))], "lane-name"),
      track,
      el("span", { className: "lane-value" }, trace?.serviceBack ? signedSeconds(trace.serviceBack.t) : row.service));
  };

  const ticks = Array.from({ length: Math.floor(axisMax / 1000) + 1 }, (_, i) =>
    el("span", { style: `left:${pct(i * 1000)}` }, i === 0 ? "T 0" : `+${i} s`));

  const dut = pair.dut.trace;
  const cdut = pair.cdut.trace;
  const chip = (label, value, note, tone) => el("div", { className: `delta ${tone}` },
    el("span", { className: "delta-label" }, label), el("strong", {}, value), note ? el("small", {}, note) : null);
  const deltas = [];
  if (dut.milestones.report && cdut.milestones.report) {
    const diff = dut.milestones.report.t - cdut.milestones.report.t;
    deltas.push(chip(t("compare.delta.report"), `+${seconds(diff)}`,
      t("compare.delta.ratio", { ratio: (dut.milestones.report.t / cdut.milestones.report.t).toLocaleString(getLang(), { maximumFractionDigits: 1 }) }), "bad"));
  }
  if (dut.serviceBack && cdut.serviceBack) {
    deltas.push(chip(t("compare.delta.service"), `+${seconds(dut.serviceBack.t - cdut.serviceBack.t)}`,
      t("compare.delta.serviceNote", { dut: signedSeconds(dut.serviceBack.t), cdut: signedSeconds(cdut.serviceBack.t) }), "bad"));
  }
  if (comparison?.counts) {
    const [dutRlf, dutN] = comparison.counts.dut;
    const [cdutRlf, cdutN] = comparison.counts.cdut;
    deltas.push(chip(t("compare.delta.rlf"), `${dutRlf}/${dutN} × ${cdutRlf}/${cdutN}`, t("compare.delta.rlfNote"), "bad"));
  }
  const resel = dut.reselection;
  if (resel && Number.isFinite(resel.oldLayerMs) && dut.milestones.reestComplete) {
    deltas.push(chip(t("compare.delta.oldLayer", { pci: config.serving.pci }), `${Math.round(resel.oldLayerMs)} ms`,
      t("compare.delta.oldLayerNote", { total: Math.round(dut.milestones.reestComplete.t - dut.milestones.rlf.t) }), "warn"));
  }

  const table = comparison && el("table", { className: "compare-table" },
    el("thead", {}, el("tr", {}, ["scenario", "report", "outcome", "service", "rlf"].map((key) => el("th", {}, t(`compare.col.${key}`))))),
    el("tbody", {}, comparison.rows.map((row) => el("tr", { className: row.tone },
      el("td", {}, row.label), el("td", {}, row.report), el("td", {}, row.outcome), el("td", {}, row.service), el("td", {}, row.rlf)))));

  const node = el("div", { className: "insight-compare" },
    el("p", { className: "insight-sub" }, t("compare.intro")),
    el("div", { className: "lanes" },
      comparison.rows.map(lane),
      el("div", { className: "lane lane-axis" }, el("span"), el("div", { className: "lane-ticks" }, ticks), el("span"))),
    el("div", { className: "lane-legend" },
      ["a5", "report", "ho", "rlf", "reest"].map((kind) => el("span", { className: `lane-legend-item ${kind}` }, el("i"), t(`compare.legend.${kind}`))),
      el("span", { className: "lane-legend-item wait" }, el("i"), t("compare.legend.wait"))),
    el("div", { className: "deltas" }, deltas),
    table,
    comparison?.note ? el("p", { className: "insight-note" }, comparison.note) : null);

  return {
    node,
    update(state, scenario) {
      for (const [id, cursor] of cursors) {
        const time = cursorTime(state, scenario, id);
        cursor.hidden = time === null || time < 0;
        if (!cursor.hidden) cursor.style.left = pct(time);
      }
    }
  };
}
