import { $, el, svgEl } from "../dom.js";
import { t, getLang } from "../i18n.js";

// "KPI test" panel for throughput challenges (`challenge.kpiTest`): validates the
// iterations against the procedure, computes the verdict (mean and sample σ
// deltas, per direction), compares the KPIs of the analysed iteration and plots
// them per second. The per-second counters come from the logs (#kpi-data).
const TABS = ["verdict", "kpis", "charts"];

const fmt = (value, digits = 1) => Number.isFinite(value)
  ? value.toLocaleString(getLang(), { minimumFractionDigits: digits, maximumFractionDigits: digits }).replace("-", "−")
  : "—";
const signed = (value, digits = 1) => Number.isFinite(value) ? `${value > 0 ? "+" : ""}${fmt(value, digits)}` : "—";

// ---------- procedure: validity and verdict (pure, exported for tests) ----------

// Reasons an iteration must be discarded before any calculation (empty = valid).
export function iterationProblems(it, criteria) {
  const problems = [];
  const devices = ["DUT", "CDUT"];
  it.cells.forEach((cells, d) => {
    if (Number(cells[criteria.pci]) !== 100) problems.push({ key: "ktest.reason.cell", params: { device: devices[d], cells: cellText(cells) } });
  });
  it.rsrp.forEach((rsrp, d) => {
    if (!(rsrp > criteria.rsrpMin && it.sinr[d] > criteria.sinrMin)) {
      problems.push({ key: "ktest.reason.coverage", params: { device: devices[d], rsrp: fmt(rsrp), sinr: fmt(it.sinr[d]) } });
    }
  });
  const dRsrp = Math.abs(it.rsrp[0] - it.rsrp[1]);
  const dSinr = Math.abs(it.sinr[0] - it.sinr[1]);
  if (dRsrp > criteria.rfDelta || dSinr > criteria.rfDelta) {
    problems.push({ key: "ktest.reason.rf", params: { rsrp: fmt(dRsrp), sinr: fmt(dSinr), max: criteria.rfDelta } });
  }
  return problems;
}

export const cellText = (cells) => Object.entries(cells)
  .map(([pci, pct]) => Number(pct) === 100 ? `PCI ${pci}` : `PCI ${pci} ${pct}%`).join(" + ");

export function sampleStats(values) {
  const n = values.length;
  const mean = values.reduce((sum, value) => sum + value, 0) / n;
  const sd = n > 1 ? Math.sqrt(values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (n - 1)) : NaN;
  return { n, mean, sd };
}

// Verdict per direction over the chosen iterations ("valid" or "all").
export function kpiVerdict(config, scope) {
  const { criteria } = config;
  const used = config.iterations.filter((it) => scope === "all" || iterationProblems(it, criteria).length === 0);
  const direction = (key) => {
    const dut = sampleStats(used.map((it) => it[key][0]));
    const cdut = sampleStats(used.map((it) => it[key][1]));
    const dMean = (dut.mean - cdut.mean) / cdut.mean * 100;
    const dSigma = (dut.sd - cdut.sd) / cdut.sd * 100;
    const passMean = Math.abs(dMean) < criteria.meanPct;
    const passSigma = Math.abs(dSigma) < criteria.sigmaPct;
    return { n: used.length, dut, cdut, dMean, dSigma, passMean, passSigma, pass: passMean && passSigma };
  };
  const dl = direction("dl");
  const ul = direction("ul");
  const conclusive = used.length >= criteria.minValid;
  return { used, dl, ul, conclusive, pass: conclusive && dl.pass && ul.pass };
}

// ---------- KPIs of one iteration (same formulas as the log's "KPIs" tab) ----------

const sum = (rows, key) => rows.reduce((total, row) => total + (Number(row[key]) || 0), 0);
const avg = (rows, key) => sum(rows, key) / rows.length;

export function aggregateKpis(rows) {
  const s = rows.length;
  const c = (key) => sum(rows, key);
  return {
    rsrp: avg(rows, "rsrp"),
    sinr: avg(rows, "sinr"),
    ri: c("ri_sum") / c("n_csi"),
    cqi: c("cqi_sum") / c("n_csi"),
    dSched: 100 * c("dec") / c("dlslots"),
    dPrb: c("dprb") / c("dec"),
    dMcs: c("d_mcs") / c("first"),
    dLayers: c("d_lay") / c("first"),
    dTbs: c("d_tbs") / c("first"),
    dTbsPerLayer: c("d_tbs") / c("d_lay"),
    dFirstRate: c("first") / s,
    dDelivered: c("okB") / c("d_tbs"),
    dBler: 100 * c("firstfail") / c("first"),
    dRetx: 100 * c("retx") / c("dec"),
    dAcked: c("okB") * 8 / 1e6 / s,
    uSched: 100 * c("ugr") / c("ulslots"),
    uGrantRate: c("ugr") / s,
    uPrb: c("uprb") / c("ugr"),
    uMcs: c("u_mcs") / c("u_new"),
    uTbs: c("u_tbs") / c("u_new"),
    uNewShare: c("u_new") / c("ugr"),
    uDelivered: c("uokB") / c("u_tbs"),
    uRetx: 100 * c("uretx") / c("ugr"),
    uHarqFail: c("uhfail") / s,
    uRlc: 100 * c("ulostB") / Math.max(1, c("uokB")),
    uAcked: c("uokB") * 8 / 1e6 / s
  };
}

// Per-second series for the charts.
const perSecond = (rows) => ({
  rsrp: rows.map((row) => row.rsrp),
  sinr: rows.map((row) => row.sinr),
  dMcs: rows.map((row) => row.d_mcs / row.first),
  uMcs: rows.map((row) => row.u_mcs / row.u_new),
  dAcked: rows.map((row) => row.okB * 8 / 1e6),
  uAcked: rows.map((row) => row.uokB * 8 / 1e6),
  dLayers: rows.map((row) => row.d_lay / row.first),
  uRetx: rows.map((row) => 100 * row.uretx / row.ugr)
});

// ---------- view ----------

export function mountKpiTestView(actions) {
  const panel = $("#kpi-panel");
  const tabs = $("#kpi-tabs");
  const body = $("#kpi-body");
  let lastKey = "";
  let update = () => {};

  tabs.addEventListener("click", (event) => {
    const button = event.target.closest("[data-tab]");
    if (button) selectTab(button.dataset.tab);
  });
  const selectTab = (tab) => {
    actions.onSetTab(tab);
    tabs.querySelector(`[data-tab="${tab}"]`)?.focus();
  };
  tabs.addEventListener("keydown", (event) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    const current = TABS.indexOf(event.target.dataset.tab);
    if (current < 0) return;
    event.preventDefault();
    if (event.key === "Home") return selectTab(TABS[0]);
    if (event.key === "End") return selectTab(TABS.at(-1));
    const next = TABS[(current + (event.key === "ArrowRight" ? 1 : TABS.length - 1)) % TABS.length];
    selectTab(next);
  });
  body.addEventListener("click", (event) => {
    if (event.target.closest("[data-kpi-retry]")) {
      actions.onRetry();
      body.focus();
      return;
    }
    const scope = event.target.closest("[data-scope]");
    if (scope) {
      actions.onSetScope(scope.dataset.scope);
      body.querySelector(`[data-scope="${scope.dataset.scope}"]`)?.focus();
    }
  });

  return function render(state, challenge, scenario) {
    const config = challenge.kpiTest;
    panel.hidden = !config;
    if (!config) {
      lastKey = "";
      return;
    }
    const kpi = state.kpiData?.challengeId === challenge.id ? state.kpiData : null;
    const key = [challenge.id, scenario.id, getLang(), state.kpiTab, state.kpiScope,
      kpi?.byScenario ? "ready" : kpi?.error || "loading"].join("|");
    if (key !== lastKey) {
      lastKey = key;
      const tabHadFocus = tabs.contains(document.activeElement);
      tabs.replaceChildren(...TABS.map((tab) => el("button", {
        type: "button",
        role: "tab",
        id: `kpi-tab-${tab}`,
        className: "insight-tab",
        "data-tab": tab,
        "aria-controls": body.id,
        "aria-selected": String(tab === state.kpiTab),
        tabIndex: tab === state.kpiTab ? 0 : -1
      }, t(`ktest.tab.${tab}`))));
      if (tabHadFocus) tabs.querySelector('[aria-selected="true"]').focus();
      body.setAttribute("aria-labelledby", `kpi-tab-${state.kpiTab}`);
      update = () => {};
      const ctx = { state, challenge, scenario, config, kpi: kpi?.byScenario };
      if (state.kpiTab !== "verdict" && !kpi?.byScenario) {
        body.replaceChildren(
          el("p", { className: "insight-empty", role: "status" }, kpi?.error ? t("ktest.error", { error: kpi.error }) : t("ktest.loading")),
          ...(kpi?.error ? [el("button", { type: "button", className: "button quiet", "data-kpi-retry": "" }, t("ktest.retry"))] : []));
      } else {
        const built = state.kpiTab === "kpis" ? buildKpis(ctx) : state.kpiTab === "charts" ? buildCharts(ctx) : buildVerdict(ctx);
        body.replaceChildren(built.node);
        update = built.update || update;
      }
    }
    update(state, scenario);
  };
}

const device = (challenge, id) => challenge.scenarios.find((item) => item.id === id);
const deviceLabel = (challenge, id) => {
  const [name, role] = device(challenge, id).device.split("/").map((part) => part.trim());
  return `${name} (${role})`;
};
const passText = (pass) => el("strong", { className: pass ? "kpi-pass" : "kpi-fail" }, pass ? "PASS" : "FAIL");

// Tab 1: the 15 iterations against the procedure, then mean, σ and deltas.
function buildVerdict({ state, challenge, config }) {
  const { criteria } = config;
  const scope = state.kpiScope === "all" ? "all" : "valid";
  const result = kpiVerdict(config, scope);
  const other = kpiVerdict(config, scope === "all" ? "valid" : "all");

  const scopeSwitch = el("div", { className: "kpi-scope", role: "group", "aria-label": t("ktest.scopeAria") },
    ...["valid", "all"].map((value) => el("button", { type: "button", "data-scope": value, "aria-pressed": String(value === scope) }, t(`ktest.scope.${value}`))));

  const rows = config.iterations.map((it) => {
    const problems = iterationProblems(it, criteria);
    const valid = problems.length === 0;
    const counted = scope === "all" || valid;
    return el("tr", { className: `${valid ? "" : "discarded"}${it.it === config.analyzed ? " analysed" : ""}` },
      el("td", {}, String(it.it), it.it === config.analyzed ? el("small", { className: "kpi-flag" }, t("ktest.inLog")) : ""),
      ...[it.dl[0], it.dl[1], it.ul[0], it.ul[1]].map((value) => el("td", { className: "num" }, fmt(value))),
      el("td", {}, `${cellText(it.cells[0])} · ${cellText(it.cells[1])}`),
      el("td", { className: "num" }, `${fmt(it.rsrp[0])} · ${fmt(it.rsrp[1])}`),
      el("td", { className: "num" }, `${fmt(it.sinr[0])} · ${fmt(it.sinr[1])}`),
      el("td", {}, valid
        ? el("span", { className: "kpi-ok" }, t("ktest.valid"))
        : el("span", { className: "kpi-reasons" }, el("strong", {}, t(counted ? "ktest.discardedCounted" : "ktest.discarded")),
          ...problems.map((problem) => el("span", {}, t(problem.key, problem.params))))));
  });
  const iterationTable = el("div", { className: "kpi-table-wrap" },
    el("table", { className: "kpi-table iterations" },
      el("thead", {}, el("tr", {},
        ...["it", "dlDut", "dlCdut", "ulDut", "ulCdut", "cells", "rsrp", "sinr", "status"].map((col) => el("th", {}, t(`ktest.col.${col}`))))),
      el("tbody", {}, ...rows)));

  const line = (label, dl, ul, className = "") => el("tr", { className }, el("th", { scope: "row" }, label), el("td", {}, dl), el("td", {}, ul));
  const mbps = (value) => `${fmt(value, 2)} Mbps`;
  const pct = (value) => `${signed(value, 2)}%`;
  const verdictTable = el("div", { className: "kpi-table-wrap" },
    el("table", { className: "kpi-table verdict" },
      el("thead", {}, el("tr", {}, el("th", {}, t("ktest.col.metric")), el("th", {}, "Downlink"), el("th", {}, "Uplink"))),
      el("tbody", {},
        line(t("ktest.row.n"), String(result.dl.n), String(result.ul.n)),
        line(t("ktest.row.meanDut"), mbps(result.dl.dut.mean), mbps(result.ul.dut.mean)),
        line(t("ktest.row.meanCdut"), mbps(result.dl.cdut.mean), mbps(result.ul.cdut.mean)),
        line(t("ktest.row.dMean"), pct(result.dl.dMean), pct(result.ul.dMean)),
        line(t("ktest.row.critA", { max: criteria.meanPct }), passText(result.dl.passMean), passText(result.ul.passMean), "criterion"),
        line(t("ktest.row.sdDut"), mbps(result.dl.dut.sd), mbps(result.ul.dut.sd)),
        line(t("ktest.row.sdCdut"), mbps(result.dl.cdut.sd), mbps(result.ul.cdut.sd)),
        line(t("ktest.row.dSigma"), pct(result.dl.dSigma), pct(result.ul.dSigma)),
        line(t("ktest.row.critB", { max: criteria.sigmaPct }), passText(result.dl.passSigma), passText(result.ul.passSigma), "criterion"),
        line(t("ktest.row.direction"), passText(result.dl.pass), passText(result.ul.pass), "total"))));

  const overall = !result.conclusive
    ? el("span", { className: "kpi-badge warn" }, t("ktest.inconclusive", { n: result.used.length, min: criteria.minValid }))
    : el("span", { className: `kpi-badge ${result.pass ? "pass" : "fail"}` },
      t(scope === "all" ? "ktest.simulated" : result.pass ? "ktest.overallPass" : "ktest.overallFail",
        { verdict: result.pass ? "PASS" : "FAIL" }));

  // What changes between the two scopes: the reason the procedure discards first.
  const flips = [];
  for (const dir of ["dl", "ul"]) {
    const name = dir === "dl" ? "DL" : "UL";
    if (result[dir].passMean !== other[dir].passMean) flips.push(t("ktest.flip", { dir: name, crit: "(a)", from: result[dir].passMean ? "PASS" : "FAIL", to: other[dir].passMean ? "PASS" : "FAIL" }));
    if (result[dir].passSigma !== other[dir].passSigma) flips.push(t("ktest.flip", { dir: name, crit: "(b)", from: result[dir].passSigma ? "PASS" : "FAIL", to: other[dir].passSigma ? "PASS" : "FAIL" }));
  }
  const otherLabel = t(`ktest.scope.${scope === "all" ? "valid" : "all"}`);
  const note = el("p", { className: "insight-note" },
    t("ktest.otherScope", {
      other: otherLabel,
      dl: `${pct(other.dl.dMean)} / ${pct(other.dl.dSigma)}`,
      ul: `${pct(other.ul.dMean)} / ${pct(other.ul.dSigma)}`
    }),
    " ",
    flips.length ? t("ktest.flips", { list: flips.join("; ") }) : t("ktest.noFlips"));

  const discarded = config.iterations.filter((it) => iterationProblems(it, criteria).length).map((it) => it.it);
  return {
    node: el("div", { className: "kpi-verdict-tab" },
      el("div", { className: "insight-head" },
        el("div", {},
          el("strong", { className: "insight-focus" }, t("ktest.verdictHead")),
          el("span", { className: "insight-sub" }, t("ktest.criteria", {
            rsrp: fmt(criteria.rsrpMin, 0), sinr: fmt(criteria.sinrMin, 0), rf: criteria.rfDelta,
            pci: criteria.pci, arfcn: criteria.arfcn, min: criteria.minValid, mean: criteria.meanPct, sigma: criteria.sigmaPct
          }))),
        scopeSwitch),
      iterationTable,
      el("p", { className: "kpi-caption" }, t("ktest.discardSummary", {
        n: discarded.length, list: discarded.join(", "), valid: config.iterations.length - discarded.length,
        dut: deviceLabel(challenge, config.dut), cdut: deviceLabel(challenge, config.cdut)
      })),
      el("div", { className: "kpi-verdict-row" }, verdictTable, el("div", { className: "kpi-overall" }, overall,
        el("small", {}, t(scope === "all" ? "ktest.scopeAllNote" : "ktest.scopeValidNote")))),
      note)
  };
}

// Tab 2: the analysed iteration, KPI by KPI, and the KPI chain that splits the gap.
function buildKpis({ challenge, config, kpi }) {
  const dut = aggregateKpis(kpi[config.dut].rows);
  const cdut = aggregateKpis(kpi[config.cdut].rows);
  const it = config.iterations.find((item) => item.it === config.analyzed);
  const app = { dl: it?.dl || [NaN, NaN], ul: it?.ul || [NaN, NaN] };

  // [label key, dut, cdut, digits, compare] — "delta" for dB values, "ratio" otherwise.
  const groups = [
    ["rf", [
      ["rsrp", dut.rsrp, cdut.rsrp, 1, "delta"],
      ["sinr", dut.sinr, cdut.sinr, 1, "delta"],
      ["ri", dut.ri, cdut.ri, 2, "ratio"],
      ["cqi", dut.cqi, cdut.cqi, 2, "ratio"]
    ]],
    ["dl", [
      ["sched", dut.dSched, cdut.dSched, 1, "ratio"],
      ["prbSlot", dut.dPrb, cdut.dPrb, 0, "ratio"],
      ["mcs", dut.dMcs, cdut.dMcs, 2, "ratio"],
      ["layers", dut.dLayers, cdut.dLayers, 2, "ratio"],
      ["tbs", dut.dTbs, cdut.dTbs, 0, "ratio"],
      ["bler", dut.dBler, cdut.dBler, 2, "ratio"],
      ["retxMac", dut.dRetx, cdut.dRetx, 2, "ratio"],
      ["acked", dut.dAcked, cdut.dAcked, 1, "ratio"],
      ["app", app.dl[0], app.dl[1], 1, "ratio"]
    ]],
    ["ul", [
      ["sched", dut.uSched, cdut.uSched, 1, "ratio"],
      ["prbGrant", dut.uPrb, cdut.uPrb, 0, "ratio"],
      ["mcs", dut.uMcs, cdut.uMcs, 2, "ratio"],
      ["tbs", dut.uTbs, cdut.uTbs, 0, "ratio"],
      ["retxGrants", dut.uRetx, cdut.uRetx, 2, "ratio"],
      ["harqFail", dut.uHarqFail, cdut.uHarqFail, 2, "ratio"],
      ["retxRlc", dut.uRlc, cdut.uRlc, 2, "ratio"],
      ["acked", dut.uAcked, cdut.uAcked, 1, "ratio"],
      ["app", app.ul[0], app.ul[1], 1, "ratio"]
    ]]
  ];
  // A KPI "diverges" beyond 15 % (or 3 dB, the procedure's RF tolerance).
  const diverges = (a, b, compare) => compare === "delta"
    ? Math.abs(a - b) > config.criteria.rfDelta
    : Number.isFinite(a) && Number.isFinite(b) && a !== b && Math.abs(a / b - 1) > 0.15;
  const comparison = (a, b, compare, digits) => compare === "delta"
    ? `${signed(a - b, digits)} dB`
    : b === 0 ? "—" : `×${fmt(a / b, 2)}`;
  const body = groups.flatMap(([group, items]) => [
    el("tr", { className: "group" }, el("th", { colSpan: 4, scope: "colgroup" }, t(`ktest.group.${group}`))),
    ...items.map(([label, a, b, digits, compare]) => el("tr", { className: diverges(a, b, compare) ? "diverge" : "" },
      el("th", { scope: "row" }, t(`ktest.kpi.${label}`)),
      el("td", { className: "num" }, fmt(a, digits)),
      el("td", { className: "num" }, fmt(b, digits)),
      el("td", { className: "num" }, comparison(a, b, compare, digits))))
  ]);
  const table = el("div", { className: "kpi-table-wrap" },
    el("table", { className: "kpi-table kpis" },
      el("thead", {}, el("tr", {},
        el("th", {}, t("ktest.col.kpi")),
        el("th", {}, deviceLabel(challenge, config.dut)),
        el("th", {}, deviceLabel(challenge, config.cdut)),
        el("th", {}, t("ktest.col.ratio")))),
      el("tbody", {}, ...body)));

  // The factors telescope to acknowledged bytes per second. PRBs and MCS
  // already affect TBS and must not multiply it a second time.
  const chain = (title, factors, total, rest) => {
    const product = factors.reduce((value, [, ratio]) => value * ratio, 1);
    return el("div", { className: "kpi-chain" },
      el("strong", {}, title),
      el("div", { className: "kpi-chain-factors" },
        ...factors.flatMap(([label, ratio], index) => [
          ...(index ? [el("span", { className: "kpi-chain-op" }, "×")] : []),
          el("span", { className: `kpi-factor${Math.abs(ratio - 1) > 0.15 ? " off" : ""}` }, el("small", {}, label), `×${fmt(ratio, 2)}`)
        ]),
        el("span", { className: "kpi-chain-op" }, "="),
        el("span", { className: "kpi-factor total" }, el("small", {}, t("ktest.chain.product")), `×${fmt(product, 2)}`)),
      el("small", { className: "kpi-chain-note" }, t("ktest.chain.check", { ratio: fmt(total, 2) }), " ", rest));
  };
  const r = (key) => dut[key] / cdut[key];
  const dlChain = chain(t("ktest.chain.dl"), [
    [t("ktest.chain.first"), r("dFirstRate")],
    [t("ktest.chain.tbsLayer"), r("dTbsPerLayer")],
    [t("ktest.chain.layers"), r("dLayers")],
    [t("ktest.chain.delivered"), r("dDelivered")]
  ], r("dAcked"), config.chainNotes?.dl || "");
  const ulChain = chain(t("ktest.chain.ul"), [
    [t("ktest.chain.grants"), r("uGrantRate")],
    [t("ktest.chain.tbs"), r("uTbs")],
    [t("ktest.chain.newShare"), r("uNewShare")],
    [t("ktest.chain.delivered"), r("uDelivered")]
  ], r("uAcked"), config.chainNotes?.ul || "");

  return {
    node: el("div", {},
      el("div", { className: "insight-head" }, el("div", {},
        el("strong", { className: "insight-focus" }, t("ktest.kpisHead", { it: config.analyzed })),
        el("span", { className: "insight-sub" }, t("ktest.kpisSub")))),
      table,
      el("div", { className: "kpi-chains" }, dlChain, ulChain))
  };
}

// Tab 3: per-second series of both devices, with the replay cursor.
function buildCharts({ challenge, config, kpi }) {
  const series = { [config.dut]: perSecond(kpi[config.dut].rows), [config.cdut]: perSecond(kpi[config.cdut].rows) };
  const cursors = [];
  const W = 480;
  const H = 180;
  const L = 40;
  const R = 10;
  const T = 12;
  const B = 24;
  const duration = Math.max(...kpi[config.dut].rows.map((row) => row.t), ...kpi[config.cdut].rows.map((row) => row.t));
  const x = (second) => L + second / duration * (W - L - R);

  const chart = (key, unit, min, max, step) => {
    const y = (value) => T + (max - value) / (max - min) * (H - T - B);
    const svg = svgEl("svg", { viewBox: `0 0 ${W} ${H}`, class: "kpi-chart", role: "img", "aria-label": t(`ktest.chart.${key}`) });
    const grid = svgEl("g", { class: "chart-grid" });
    for (let value = min; value <= max; value += step) {
      grid.append(svgEl("line", { x1: L, x2: W - R, y1: y(value), y2: y(value) }));
      const label = svgEl("text", { x: L - 5, y: y(value) + 3, "text-anchor": "end", class: "chart-tick" });
      label.textContent = fmt(value, step < 1 ? 1 : 0);
      grid.append(label);
    }
    for (let second = 0; second <= duration; second += 10) {
      grid.append(svgEl("line", { x1: x(second), x2: x(second), y1: T, y2: H - B, class: "chart-vgrid" }));
      const label = svgEl("text", { x: x(second), y: H - 8, "text-anchor": "middle", class: "chart-tick" });
      label.textContent = `${second} s`;
      grid.append(label);
    }
    const unitLabel = svgEl("text", { x: L, y: T - 3, class: "chart-unit" });
    unitLabel.textContent = unit;
    svg.append(grid, unitLabel);
    for (const [id, kind] of [[config.cdut, "cdut"], [config.dut, "dut"]]) {
      const values = series[id][key];
      const d = values.map((value, index) => `${index ? "L" : "M"}${x(kpi[id].rows[index].t).toFixed(1)},${y(value).toFixed(1)}`).join("");
      svg.append(svgEl("path", { d, class: `kpi-line ${kind}` }));
    }
    const cursor = svgEl("line", { x1: 0, x2: 0, y1: T, y2: H - B, class: "kpi-cursor", visibility: "hidden" });
    svg.append(cursor);
    cursors.push(cursor);
    const mean = (id) => fmt(series[id][key].reduce((total, value) => total + value, 0) / series[id][key].length, 1);
    return el("figure", { className: "kpi-chart-card" },
      el("figcaption", {}, el("strong", {}, t(`ktest.chart.${key}`)),
        el("small", {}, t("ktest.chart.means", { dut: mean(config.dut), cdut: mean(config.cdut) }))),
      svg);
  };

  const legend = el("div", { className: "kpi-legend" },
    el("span", { className: "dut" }, deviceLabel(challenge, config.dut)),
    el("span", { className: "cdut" }, deviceLabel(challenge, config.cdut)),
    el("span", { className: "cursor" }, t("ktest.chart.cursor")));

  return {
    node: el("div", {},
      el("div", { className: "insight-head" }, el("div", {},
        el("strong", { className: "insight-focus" }, t("ktest.chartsHead", { it: config.analyzed })),
        el("span", { className: "insight-sub" }, t("ktest.chartsSub"))), legend),
      el("div", { className: "kpi-charts" },
        chart("dAcked", "Mbps", 0, 1200, 300),
        chart("uAcked", "Mbps", 0, 100, 25),
        chart("dLayers", t("ktest.chart.layersUnit"), 0, 4, 1),
        chart("uRetx", "%", 0, 100, 25),
        chart("rsrp", "dBm", -85, -75, 2),
        chart("sinr", "dB", 15, 30, 3),
        chart("dMcs", "MCS", 0, 28, 7),
        chart("uMcs", "MCS", 0, 28, 7))),
    // The cursor follows the replay while it runs on one of the two devices.
    update: (state, scenario) => {
      const event = state.replay.events[state.replay.index];
      const onPair = [config.dut, config.cdut].includes(scenario.id);
      const second = event && Number.isFinite(event.refTimeMs) ? event.refTimeMs / 1000 : NaN;
      const visible = onPair && second >= 0 && second <= duration;
      for (const cursor of cursors) {
        cursor.setAttribute("visibility", visible ? "visible" : "hidden");
        if (visible) {
          cursor.setAttribute("x1", x(second));
          cursor.setAttribute("x2", x(second));
        }
      }
    }
  };
}
