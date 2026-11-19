import { describe, expect, it } from "vitest";
import { CHALLENGE_DATA, CONTENT } from "../src/data/index.js";
import { evidenceTasks, reviewAttachments } from "../src/rules/evidence.js";
import { LEVELS, PTS, attachPoints, equipmentScore, evidencePoints, levelOf, maxScore, runReward, unlocked } from "../src/rules/score.js";

const CHALLENGES = CHALLENGE_DATA.map((c) => ({ ...c, game: CONTENT[c.id] }));

describe("níveis", () => {
  it("sobe de nível exatamente no limiar de XP", () => {
    expect(levelOf(0)).toBe(0);
    expect(levelOf(299)).toBe(0);
    expect(levelOf(300)).toBe(1);
    expect(levelOf(999999)).toBe(LEVELS.length - 1);
  });
});

describe("pontuação máxima", () => {
  it("soma armário, preparação, vereditos, evidências das falhas, relatório e anexos", () => {
    for (const ch of CHALLENGES) {
      const fails = ch.scenarios.filter((s) => s.statusClass === "bad").length;
      expect(maxScore(ch)).toBe(PTS.equipment + ch.game.setup.length * PTS.choice + ch.scenarios.length * PTS.verdict + fails * PTS.evidence + ch.game.report.length * PTS.report + PTS.attach);
    }
  });
});

describe("armário", () => {
  const req = ["modemlog", "cdut", "remote"], neu = ["gps"];
  it("materiais perfeitos valem o máximo; neutros não descontam", () => {
    expect(equipmentScore(req, neu, ["modemlog", "cdut", "remote", "gps"])).toEqual({ pts: PTS.equipment, missing: [], extra: [] });
  });
  it("−10 por obrigatório faltando e −8 por desnecessário, nunca negativo", () => {
    expect(equipmentScore(req, neu, ["modemlog", "cdut", "camera"])).toEqual({ pts: PTS.equipment - 10 - 8, missing: ["remote"], extra: ["camera"] });
    expect(equipmentScore(req, neu, ["a", "b", "c", "d", "e"]).pts).toBe(0);
  });
});

describe("análise e anexos", () => {
  it("pontua pelo papel técnico, sem usar a cor", () => {
    expect(evidencePoints("symptom")).toBe(PTS.evidence);
    expect(evidencePoints("mechanism")).toBe(PTS.evidence);
    expect(evidencePoints("context")).toBe(PTS.evidence / 2);
    expect(evidencePoints("bad-text")).toBe(0);
  });
  it("aceita RF da referência e exige mecanismos distintos no D7", () => {
    const { scenarios } = CHALLENGES.find(({ id }) => id === "desafio-7");
    const items = scenarios.flatMap(({ metrics }) => metrics);
    const tasks = evidenceTasks(items);
    expect(tasks).toEqual(["symptom", "context", "dl", "ul"]);
    const choices = { symptom: 4, context: 3, dl: 5, ul: 6 };
    const report = reviewAttachments(tasks, items, choices);
    expect(report.every(({ correct }) => correct)).toBe(true);
    expect(attachPoints(report)).toBe(PTS.attach);
    expect(attachPoints(reviewAttachments(tasks, items, { ...choices, ul: 5 }))).toBe(38);
    expect(attachPoints(reviewAttachments(tasks, items, {}))).toBe(0);
  });
});

describe("recompensa", () => {
  it("primeira conclusão paga o total em moedas", () => {
    const r = runReward(272, 300, undefined);
    expect(r).toEqual({ stars: 3, coins: 272, progress: { completed: true, best: 272, runs: 1, stars: 3 } });
  });
  it("repetição paga a melhora sobre o recorde + 35% do total e mantém o melhor", () => {
    const prev = { completed: true, best: 250, runs: 1, stars: 3 };
    const r = runReward(200, 300, prev);
    expect(r.coins).toBe(0 + Math.round(200 * 0.35));
    expect(r.progress).toEqual({ completed: true, best: 250, runs: 2, stars: 3 });
    expect(r.stars).toBe(2);
  });
  it("estrelas: ≥85% = 3, ≥60% = 2, abaixo = 1", () => {
    expect(runReward(85, 100).stars).toBe(3);
    expect(runReward(60, 100).stars).toBe(2);
    expect(runReward(59, 100).stars).toBe(1);
  });
});

describe("desafios liberados", () => {
  it("só o primeiro no começo; o seguinte libera quando o anterior é concluído", () => {
    expect(unlocked(CHALLENGES, {}).map((c) => c.id)).toEqual(["desafio-2"]);
    expect(unlocked(CHALLENGES, { "desafio-2": { completed: true } }).map((c) => c.id)).toEqual(["desafio-2", "desafio-3"]);
  });
});
