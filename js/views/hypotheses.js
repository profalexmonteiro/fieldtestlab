import { el } from "../dom.js";
import { t, getLang } from "../i18n.js";
import { jumpButton } from "./insight-common.js";

const logFactorial = (n) => { let sum = 0; for (let i = 2; i <= n; i++) sum += Math.log(i); return sum; };
const logChoose = (n, k) => logFactorial(n) - logFactorial(k) - logFactorial(n - k);

// Fisher's exact test on [[a, b], [c, d]] (rows: devices, columns: RLF / no RLF).
export function fisherExact(a, b, c, d) {
  const row1 = a + b;
  const row2 = c + d;
  const col1 = a + c;
  const total = row1 + row2;
  const p = (x) => Math.exp(logChoose(row1, x) + logChoose(row2, col1 - x) - logChoose(total, col1));
  const observed = p(a);
  let twoSided = 0;
  let greater = 0;
  for (let x = Math.max(0, col1 - row2); x <= Math.min(row1, col1); x++) {
    const px = p(x);
    if (px <= observed * (1 + 1e-7)) twoSided += px;
    if (x >= a) greater += px;
  }
  return { twoSided: Math.min(1, twoSided), oneSided: Math.min(1, greater) };
}

// Exact (Clopper–Pearson) 95 % interval for the all-or-none outcomes of the case.
function extremeInterval(k, n) {
  const edge = Math.pow(0.025, 1 / n);
  if (k === n) return [edge, 1];
  if (k === 0) return [0, 1 - edge];
  return null;
}

const pValue = (value) => value.toLocaleString(getLang(), { maximumSignificantDigits: 2 });
const percent = (value) => `${Math.round(value * 100)} %`;

// Tab 4: hypotheses with their evidence (links into the logs), the
// student's own marks, and the conclusion behind a reveal button.
export function buildHypotheses(ctx) {
  const { challenge, state } = ctx;
  const hypotheses = challenge.hypotheses || [];
  const marks = state.hypothesisMarks || {};
  const revealed = Boolean(state.revealed);
  const ruledOut = hypotheses.filter((item) => marks[item.id]).length;

  const cards = hypotheses.map((item) => el("article", { className: `hypothesis${marks[item.id] ? " marked" : ""}` },
    el("div", { className: "hypothesis-head" },
      el("strong", {}, item.title),
      el("label", { className: "insight-check" },
        el("input", { type: "checkbox", "data-hypothesis": item.id, ...(marks[item.id] ? { checked: "" } : {}) }),
        t("hyp.mark"))),
    el("p", { className: "hypothesis-question" }, item.question),
    el("ul", { className: "hypothesis-evidence" }, item.evidence.map((evidence) => el("li", {},
      el("span", {}, evidence.text),
      el("span", { className: "hypothesis-links" }, (evidence.links || []).map((link) =>
        jumpButton(link.scenario, link.idx, `${link.label} ↗`)))))),
    revealed ? el("p", { className: "hypothesis-verdict" }, item.verdict) : null));

  const conclusion = challenge.conclusion;
  const node = el("div", { className: "insight-hypotheses" },
    el("div", { className: "hypothesis-progress" },
      el("span", {}, t("hyp.intro")),
      el("strong", {}, t("hyp.progress", { n: ruledOut, total: hypotheses.length }))),
    el("div", { className: "hypothesis-grid" }, cards),
    conclusion ? el("div", { className: "conclusion-gate" },
      el("button", { type: "button", className: `button${revealed ? " quiet" : " primary"}`, "data-action": "reveal", "aria-expanded": String(revealed) },
        t(revealed ? "hyp.hide" : "hyp.reveal")),
      revealed ? null : el("span", { className: "insight-sub" }, t(ruledOut < hypotheses.length ? "hyp.revealHint" : "hyp.revealReady"))) : null,
    revealed && conclusion ? conclusionBlock(challenge) : null);
  return { node };
}

function conclusionBlock(challenge) {
  const { conclusion, comparison } = challenge;
  const counts = comparison?.counts;
  const stats = el("div", { className: "stats-box" });

  if (counts) {
    const [dutK, dutN] = counts.dut;
    const [cdutK, cdutN] = counts.cdut;
    const observed = fisherExact(dutK, dutN - dutK, cdutK, cdutN - cdutK);
    const dutCi = extremeInterval(dutK, dutN);
    const cdutCi = extremeInterval(cdutK, cdutN);
    const simulated = el("div", { className: "stats-sim" });
    const slider = el("input", { type: "range", min: 3, max: 30, step: 1, value: Math.max(3, dutN), "aria-label": t("stats.sliderAria") });
    const simulate = () => {
      const n = Number(slider.value);
      const sim = fisherExact(n, 0, 0, n);
      const [low] = extremeInterval(n, n);
      const [, high] = extremeInterval(0, n);
      simulated.replaceChildren(
        el("strong", {}, t("stats.simTitle", { n })),
        el("span", { className: sim.twoSided < 0.05 ? "good-text" : "bad-text" },
          t("stats.simP", { p: pValue(sim.twoSided), verdict: t(sim.twoSided < 0.05 ? "stats.significant" : "stats.notSignificant") })),
        el("span", {}, t("stats.simCi", { low: percent(low), high: percent(high) })));
    };
    slider.addEventListener("input", simulate);
    simulate();

    stats.append(
      el("div", { className: "stats-observed" },
        el("strong", {}, t("stats.observed", { dut: `${dutK}/${dutN}`, cdut: `${cdutK}/${cdutN}` })),
        el("span", { className: observed.twoSided < 0.05 ? "good-text" : "bad-text" },
          t("stats.fisher", { two: pValue(observed.twoSided), one: pValue(observed.oneSided), verdict: t(observed.twoSided < 0.05 ? "stats.significant" : "stats.notSignificant") })),
        dutCi && cdutCi ? el("span", {}, t("stats.ci", {
          dutLow: percent(dutCi[0]), dutHigh: percent(dutCi[1]), cdutLow: percent(cdutCi[0]), cdutHigh: percent(cdutCi[1])
        })) : null),
      el("label", { className: "stats-slider" }, el("span", {}, t("stats.slider")), slider),
      simulated);
  }

  return el("section", { className: "conclusion" },
    el("h4", {}, conclusion.title),
    el("p", {}, conclusion.summary),
    el("ol", {}, conclusion.symptoms.map((item) => el("li", {}, item))),
    el("p", { className: "conclusion-closing" }, conclusion.closing),
    conclusion.apparentThreshold ? el("p", { className: "insight-note" }, conclusion.apparentThreshold) : null,
    el("h4", {}, conclusion.statsTitle),
    stats,
    el("ul", { className: "conclusion-stats" }, conclusion.stats.map((item) => el("li", {}, item))));
}
