// Integridade do conteúdo em src/data: pega erros de edição nos JSON antes de chegarem ao jogo.
import { describe, expect, it } from "vitest";
import { AVATARS, BENCH_OPS, CHALLENGE_DATA, CONTENT, CORES, EQUIPMENT, NETWORK } from "../src/data/index.js";
import { opsForScenario } from "../src/rules/benchOps.js";
import { captureLines, campaignPages } from "../src/rules/capture.js";
import { reportSections } from "../src/rules/report.js";
import { evaluateTest, PTS } from "../src/rules/score.js";
import { EVIDENCE, evidenceTasks } from "../src/rules/evidence.js";
import throughput from "../../data/desafio-7.json";

const FX = ["settings", "profile", "data", "atten", "airplane", "remote", "reboot", "dial", "headset", "sos"];

describe("desafios e conteúdo", () => {
  it.each(CHALLENGE_DATA.map((c) => [c.id, c]))("%s tem conteúdo, cenários e perguntas bem formadas", (id, c) => {
    const g = CONTENT[id];
    expect(g).toBeTruthy();
    expect(c.scenarios.length).toBeGreaterThan(0);
    for (const q of [...g.setup, ...g.report]) {
      expect(q.q).toBeTruthy();
      expect(q.options.length).toBeGreaterThanOrEqual(2);
      expect(new Set(q.options).size).toBe(q.options.length);      // opções repetidas confundiriam a correta (a primeira)
    }
    for (const k of [...g.equipment.required, ...g.equipment.neutral]) expect(EQUIPMENT).toHaveProperty(k);
    const metrics = c.scenarios.flatMap((s) => s.metrics);
    expect(metrics.every(({ evidence }) => Object.hasOwn(EVIDENCE, evidence))).toBe(true);
    for (const task of evidenceTasks(metrics)) expect(metrics.some(({ evidence }) => evidence === task)).toBe(true);
    for (const scenario of c.scenarios) {
      const lines = captureLines(scenario);
      expect(lines).toHaveLength(scenario.metrics.length);
      for (const { t } of lines) {
        expect(t.length).toBeGreaterThan(0);
        expect(t).not.toMatch(/\bPASS\b|\bFAIL\b|veredito|causa raiz/i);
      }
    }
  });
});

describe("captura e revisão", () => {
  it("mostra os 15 pares na planilha e deixa o veredito para o jogador", () => {
    const pages = campaignPages(throughput.kpiTest);
    const rows = pages.flat().map(({ t }) => t).filter((line) => /^\s*\d+\s{4}/.test(line));
    expect(rows.map((line) => Number(line.trim().split(/\s+/)[0]))).toEqual(throughput.kpiTest.iterations.map(({ it }) => it));
    expect(rows[6]).toContain("214:45%+217:55%");
    expect(pages.flat().map(({ t }) => t).join(" ")).not.toMatch(/\bFAIL\b|descartada/i);
  });
  it("preserva DL e UL na análise do D7 e gera um campo de impacto", () => {
    const game = CONTENT["desafio-7"];
    const answers = game.report.map(({ options }) => ({ answer: options[0], right: true }));
    const { severity, impact, findings } = reportSections(game, answers);
    expect(severity).toBeNull();
    expect(impact).toContain("homologação");
    expect(findings).toHaveLength(game.report.length);
    expect(findings.map(({ answer }) => answer).join(" ")).toMatch(/twoLayers.*NEW_TX/);
  });
  it("identifica severidade pelo campo explícito em qualquer posição", () => {
    const game = CONTENT["desafio-6"];
    const severity = game.report.find(({ field }) => field === "severity");
    const report = [severity, ...game.report.filter((question) => question !== severity)];
    const answers = report.map(({ options }) => ({ answer: options[1], right: false }));
    const review = reportSections({ ...game, report }, answers);
    expect(review.severity.answer).toBe(severity.options[1]);
    expect(review.severity.expected).toBe(severity.options[0]);
    expect(review.findings).toHaveLength(report.length - 1);
    expect(review.findings[0].answer).toBe(answers[1].answer);
  });
  it("avalia veredito e evidência sem aumentar o teto de pontos", () => {
    const { scenarios } = CHALLENGE_DATA.find(({ id }) => id === "desafio-7");
    const [cdut, dut] = scenarios;
    expect(evaluateTest(cdut, { verdict: "pass", evidence: 0 }).points).toBe(PTS.verdict);
    expect(evaluateTest(dut, { verdict: "fail", evidence: 2 }).points).toBe(PTS.verdict + PTS.evidence);
    expect(evaluateTest(dut, { verdict: "pass", evidence: 3 })).toMatchObject({ correct: false, points: PTS.evidence / 2 });
  });
});

describe("rede", () => {
  const { sites, operators, bands, requiredCells } = NETWORK;
  it("cada site padrão tem 3 RRUs válidas", () => {
    for (const s of sites) {
      expect(s.def).toHaveLength(3);
      for (const [op, band] of s.def) { expect(operators).toContain(op); expect(s.bands).toContain(band); expect(bands).toHaveProperty(band); }
    }
  });
  it("toda célula exigida pode ser configurada em algum site", () => {
    for (const [id, cells] of Object.entries(requiredCells)) {
      expect(CONTENT).toHaveProperty(id);
      for (const [op, band] of cells) {
        expect(operators).toContain(op);
        expect(sites.some((s) => s.bands.includes(band))).toBe(true);
      }
    }
  });
  it("cada tipo de site tem rack RAN, texto de arquitetura e rack de núcleo com fluxo existente", () => {
    for (const kind of new Set(sites.map((s) => s.kind))) {
      expect(NETWORK.ranUnits[kind]).toHaveLength(4);
      expect(NETWORK.ranInfo[kind]).toHaveLength(4);
      const core = CORES.racks[kind];
      expect(core.units).toHaveLength(7);
      expect(CORES.flows).toHaveProperty(core.flow);
    }
  });
});

describe("passos de bancada", () => {
  it("todo cenário de todo desafio tem pelo menos um passo, com efeito conhecido e sem {n} sobrando", () => {
    for (const c of CHALLENGE_DATA) for (const s of c.scenarios) {
      const ops = opsForScenario(BENCH_OPS, c.id, s.label);
      expect(ops.length, `${c.id} · ${s.label}`).toBeGreaterThan(0);
      for (const o of ops) {
        expect(FX).toContain(o.fx);
        expect(JSON.stringify(o)).not.toMatch(/\{\d\}/);
      }
    }
  });
  it("D2 em LTE fixa a rede e troca o perfil eSIM com as operadoras do cenário", () => {
    const ops = opsForScenario(BENCH_OPS, "desafio-2", "Aurora · Vantis → Zenith · LTE");
    expect(ops.map((o) => o.fx)).toEqual(["settings", "profile"]);
    expect(ops[1].label).toBe("Trocar o perfil eSIM Vantis → Zenith (5 trocas)");
    expect(ops[1].lines[0]).toBe("Perfil ativo: Vantis");
  });
  it("D4: MT usa modo avião + chamada do smartphone remoto; MO usa power cycle, discagem e headset", () => {
    expect(opsForScenario(BENCH_OPS, "desafio-4", "Vanguard · MT VoNR · 5G SA").map((o) => o.fx)).toEqual(["airplane", "remote"]);
    expect(opsForScenario(BENCH_OPS, "desafio-4", "Vanguard · MO VoLTE · LTE").map((o) => o.fx)).toEqual(["reboot", "dial", "headset"]);
  });
  it("D3 escolhe o alvo do atenuador pelo tipo de handover", () => {
    expect(opsForScenario(BENCH_OPS, "desafio-3", "Meridian · intra-frequência")[1].label).toMatch(/PCI 101/);
    expect(opsForScenario(BENCH_OPS, "desafio-3", "Meridian · inter-frequência")[1].label).toMatch(/alvo n41/);
  });
});

describe("loja", () => {
  it("avatares têm id único, preço não negativo e o inicial é grátis", () => {
    expect(new Set(AVATARS.map((a) => a.id)).size).toBe(AVATARS.length);
    expect(AVATARS.every((a) => a.price >= 0)).toBe(true);
    expect(AVATARS.find((a) => a.id === "estagio").price).toBe(0);
  });
});
