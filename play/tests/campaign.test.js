// Planilha da campanha de KPI do D7: validade, estatística e correção do aluno.
import { describe, expect, it } from "vitest";
import { CHALLENGE_DATA } from "../src/data/index.js";
import {
  CAMPAIGN_PTS, campaignMax, campaignStats, expectedDiscards, gradeDeltas, gradeDiscards, iterationProblems, parseNumber
} from "../src/rules/campaign.js";

const campaign = CHALLENGE_DATA.find(({ id }) => id === "desafio-7").campaign;
const byIt = (n) => campaign.iterations.find(({ it }) => it === n);

describe("planilha da campanha", () => {
  it("descarta 3, 7, 9 e 12 pelas regras do procedimento, com o motivo de cada uma", () => {
    expect(expectedDiscards(campaign)).toEqual([3, 7, 9, 12]);
    expect(iterationProblems(byIt(3), campaign.criteria).join(" ")).toMatch(/DUT em PCI 217/);
    expect(iterationProblems(byIt(7), campaign.criteria).join(" ")).toMatch(/CDUT em PCI 214:45%\+217:55%/);
    expect(iterationProblems(byIt(9), campaign.criteria).join(" ")).toMatch(/DUT fora de Near-Cell/);
    expect(iterationProblems(byIt(12), campaign.criteria).join(" ")).toMatch(/CDUT fora de Near-Cell/);
    expect(iterationProblems(byIt(11), campaign.criteria)).toEqual([]);
  });

  it("pontua os descartes linha a linha", () => {
    expect(gradeDiscards(campaign, new Set([3, 7, 9, 12]))).toMatchObject({ correct: 15, points: CAMPAIGN_PTS.discards });
    const partial = gradeDiscards(campaign, new Set([3, 7, 11]));          // esqueceu 9 e 12, descartou a 11
    expect(partial.correct).toBe(12);
    expect(partial.points).toBe(24);
    expect(partial.rows.find((r) => r.it === 11)).toMatchObject({ expected: false, marked: true, correct: false });
  });

  it("calcula médias, σ amostral e deltas iguais ao FieldTestLab", () => {
    const valid = campaignStats(campaign, new Set([3, 7, 9, 12]));
    expect(valid.n).toBe(11);
    expect(valid.dl.dMean).toBeCloseTo(-38.98, 2);
    expect(valid.dl.dSigma).toBeCloseTo(-16.84, 2);
    expect(valid.ul.dMean).toBeCloseTo(-49.90, 2);
    expect(valid.ul.dSigma).toBeCloseTo(262.79, 2);
    expect([valid.dl.passMean, valid.dl.passSigma, valid.ul.passMean, valid.ul.passSigma]).toEqual([false, true, false, false]);
    // sem validação o σ se inverte nos dois sentidos
    const all = campaignStats(campaign, new Set());
    expect([all.dl.passSigma, all.ul.passSigma]).toEqual([false, true]);
  });

  it("lê números com vírgula, sinal de menos tipográfico e %", () => {
    expect(parseNumber("−39,0")).toBe(-39);
    expect(parseNumber("-39.0 %")).toBe(-39);
    expect(parseNumber("+262,8")).toBe(262.8);
    expect(parseNumber("abc")).toBeNaN();
    expect(parseNumber("")).toBeNaN();
  });

  it("aceita deltas dentro de ±1 p.p. e corrige o veredito por sentido", () => {
    const stats = campaignStats(campaign, new Set([3, 7, 9, 12]));
    const right = { "dl.dMean": "-39", "dl.dSigma": "-16,8", "ul.dMean": "−49,9", "ul.dSigma": "262,8", "dl.verdict": "fail", "ul.verdict": "fail" };
    expect(gradeDeltas(stats, right).points).toBe(CAMPAIGN_PTS.deltas + CAMPAIGN_PTS.verdicts);
    // inverteu o sinal do Δσ do UL e aprovou o DL
    const wrong = gradeDeltas(stats, { ...right, "ul.dSigma": "-262,8", "dl.verdict": "pass" });
    expect(wrong.deltas.filter((d) => d.correct)).toHaveLength(3);
    expect(wrong.points).toBe(15 + 5);
    expect(campaignMax()).toBe(60);
  });
});
