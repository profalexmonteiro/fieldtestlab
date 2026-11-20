// Planilha da campanha de KPI (funções puras): validade das iterações, médias e
// desvios amostrais, deltas e correção do que o aluno marcou e digitou.
// Mesmas regras do painel "Teste de KPI" do FieldTestLab (js/views/kpitest.js).

export const CAMPAIGN_PTS = { discards: 30, deltas: 20, verdicts: 10 };
export const DELTA_TOLERANCE = 1;        // pontos percentuais aceitos em cada delta digitado

const dec = (value, digits = 1) => value.toFixed(digits).replace(".", ",").replace("-", "−");
const DEVICES = ["DUT", "CDUT"];

export const cellsText = (cells) => Object.entries(cells)
  .map(([pci, pct]) => (Number(pct) === 100 ? pci : pci + ":" + pct + "%")).join("+");

/** Motivos de descarte de uma iteração (lista vazia = iteração válida). */
export function iterationProblems(it, criteria) {
  const problems = [];
  it.cells.forEach((cells, d) => {
    if (Number(cells[criteria.pci]) !== 100) problems.push(DEVICES[d] + " em PCI " + cellsText(cells));
  });
  it.rsrp.forEach((rsrp, d) => {
    if (!(rsrp > criteria.rsrpMin && it.sinr[d] > criteria.sinrMin)) {
      problems.push(DEVICES[d] + " fora de Near-Cell (" + dec(rsrp) + " dBm / " + dec(it.sinr[d]) + " dB)");
    }
  });
  const dRsrp = Math.abs(it.rsrp[0] - it.rsrp[1]);
  const dSinr = Math.abs(it.sinr[0] - it.sinr[1]);
  if (dRsrp > criteria.rfDelta || dSinr > criteria.rfDelta) {
    problems.push("Δ RF " + dec(dRsrp) + " / " + dec(dSinr) + " dB > " + criteria.rfDelta + " dB");
  }
  return problems;
}

export const expectedDiscards = (campaign) =>
  campaign.iterations.filter((it) => iterationProblems(it, campaign.criteria).length).map(({ it }) => it);

/** Corrige a marcação: acerto por linha (descartar ou manter) e pontos proporcionais. */
export function gradeDiscards(campaign, marked) {
  const rows = campaign.iterations.map((it) => {
    const reasons = iterationProblems(it, campaign.criteria);
    const expected = reasons.length > 0;
    const isMarked = marked.has(it.it);
    return { it: it.it, expected, marked: isMarked, correct: expected === isMarked, reasons };
  });
  const correct = rows.filter((row) => row.correct).length;
  return { rows, correct, points: Math.round(CAMPAIGN_PTS.discards * correct / rows.length) };
}

export function sampleStats(values) {
  const n = values.length;
  const mean = values.reduce((sum, v) => sum + v, 0) / n;
  const sd = n > 1 ? Math.sqrt(values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / (n - 1)) : NaN;
  return { n, mean, sd };
}

/** Médias, σ amostrais, deltas e critérios por sentido sobre as iterações não descartadas. */
export function campaignStats(campaign, discards) {
  const { criteria } = campaign;
  const used = campaign.iterations.filter(({ it }) => !discards.has(it));
  const direction = (key) => {
    const dut = sampleStats(used.map((it) => it[key][0]));
    const cdut = sampleStats(used.map((it) => it[key][1]));
    const dMean = (dut.mean - cdut.mean) / cdut.mean * 100;
    const dSigma = (dut.sd - cdut.sd) / cdut.sd * 100;
    const passMean = Math.abs(dMean) < criteria.meanPct;
    const passSigma = Math.abs(dSigma) < criteria.sigmaPct;
    return { dut, cdut, dMean, dSigma, passMean, passSigma, pass: passMean && passSigma };
  };
  return { n: used.length, dl: direction("dl"), ul: direction("ul") };
}

/** Aceita "−39,0", "-39.0", "39" ou "+262,8 %". */
export function parseNumber(text) {
  const clean = String(text ?? "").replace(/[−–]/g, "-").replace(/\s|%/g, "").replace(",", ".");
  return /^[-+]?\d+(\.\d+)?$/.test(clean) ? Number(clean) : NaN;
}

export const DELTA_FIELDS = [
  ["dl", "dMean", "Δ média DL"], ["dl", "dSigma", "Δσ DL"],
  ["ul", "dMean", "Δ média UL"], ["ul", "dSigma", "Δσ UL"]
];

/** Corrige os quatro deltas digitados e o veredito escolhido em cada sentido. */
export function gradeDeltas(stats, answers) {
  const deltas = DELTA_FIELDS.map(([dir, key, label]) => {
    const value = parseNumber(answers[dir + "." + key]);
    const expected = stats[dir][key];
    return { dir, key, label, value, expected, correct: Number.isFinite(value) && Math.abs(value - expected) <= DELTA_TOLERANCE };
  });
  const verdicts = ["dl", "ul"].map((dir) => {
    const value = answers[dir + ".verdict"];
    const expected = stats[dir].pass ? "pass" : "fail";
    return { dir, value, expected, correct: value === expected };
  });
  const points = Math.round(CAMPAIGN_PTS.deltas * deltas.filter((d) => d.correct).length / deltas.length)
    + Math.round(CAMPAIGN_PTS.verdicts * verdicts.filter((v) => v.correct).length / verdicts.length);
  return { deltas, verdicts, points };
}

export const campaignMax = () => CAMPAIGN_PTS.discards + CAMPAIGN_PTS.deltas + CAMPAIGN_PTS.verdicts;
