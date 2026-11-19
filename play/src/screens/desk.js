import * as THREE from "three/webgpu";
import { G } from "../core/store.js";
import { CHALLENGES, LEVELS, PTS, devName, esc, hud, isRef, levelOf, pad2, persist, save, shuffle, toast } from "../core/base.js";
import { FONT, UI, paint, setScreen } from "../ui/screens.js";
import { world } from "../world/world.js";
import { npc } from "../world/characters.js";
import { rig } from "../rig/arms.js";
import { clearBench } from "../world/benchProps.js";
import { maxScore, mouseClick, restHands, setMode } from "../game/modes.js";
import { idleTV } from "../game/npc.js";
import { quizScreen } from "./quiz.js";
import { EQUIPMENT } from "../data/index.js";
import { attachPoints, evaluateTest, runReward } from "../rules/score.js";
import { reportSections } from "../rules/report.js";
import { EVIDENCE, evidenceTasks, reviewAttachments } from "../rules/evidence.js";
import { fieldLine } from "../rules/field.js";
import { phase, setPhase } from "../game/state.js";
import { registerMode, registerStation } from "../game/registry.js";
import { emit } from "../core/events.js";

// ======================================================================
// Estação de relatório: desktop
// ======================================================================
G.deskState = null;
async function openDesk() {
  world.deskInfo.kb && (rig.L.position.copy(world.deskInfo.kb).add(new THREE.Vector3(0.1, -0.2, 0.1)), rig.R.position.copy(world.deskInfo.mouse).add(new THREE.Vector3(0.1, -0.2, 0.05)));
  if (phase !== "report" || !G.run) {
    G.deskState = { canLeave: true };
    setScreen(world.desk, (s) => {
      const k = s.k, W = s.W;
      UI.bg(s); UI.header(s, "NovaLink · Relatórios de issue", save.name || "");
      UI.text(s, G.run ? `Desafio ${pad2(G.run.ch.num)} em andamento: ` + (phase === "return" ? "devolva os materiais ao armário antes de escrever o relatório." : "termine os testes na bancada antes de escrever o relatório.") : "Nenhum relatório pendente. Fale com a Lia para receber um chamado.", 30 * k, 110 * k, { size: 30, maxW: W - 60 * k });
      CHALLENGES.forEach((c, i) => { const p = save.progress[c.id]; UI.text(s, `Desafio ${pad2(c.num)} · ${c.game.short}: ${p && p.completed ? "★".repeat(p.stars) + "  recorde " + p.best : "—"}`, 30 * k, (240 + i * 44) * k, { size: 24, color: "#46566E" }); });
      UI.btn(s, W - 290 * k, s.H - 86 * k, 266 * k, 64 * k, "Levantar ✕", () => setMode("free"), { kind: "primary", center: true, key: "Escape" });
    });
    setMode("desk"); restHands(450); return;
  }
  G.deskState = { canLeave: false };
  setMode("desk"); restHands(450);
  const g = G.run.ch.game, n = g.report.length + 1;
  for (let i = 0; i < g.report.length; i++) {
    const q = g.report[i];
    await quizScreen(world.desk, q, {
      title: "Relatório de issue · Desafio " + pad2(G.run.ch.num), right: (i + 1) + "/" + n, deferFeedback: true
    }, (_frac, right, answer) => { G.run.reportAnswers[i] = { answer, right }; }, mouseClick);
  }
  const attachmentScore = await attachScreen(n);
  G.run.score.report = G.run.reportAnswers.filter(({ right }) => right).length * PTS.report + attachmentScore;
  finalize();
}
function attachScreen(n) {
  return new Promise((resolve) => {
    const items = shuffle(G.run.ch.scenarios.flatMap((scenario) => scenario.metrics.map(({ evidence, observation }) => ({
      evidence, observation, where: scenario.label
    }))));
    const tasks = evidenceTasks(items);
    const choices = {};
    const pageSize = 6;
    const pageCount = Math.ceil(items.length / pageSize);
    let task = 0, page = 0, submitting = false;

    const moveTask = async () => {
      if (submitting) return;
      if (task < tasks.length - 1) {
        task++;
        page = 0;
        paint(world.desk);
        return;
      }
      submitting = true;
      await mouseClick();
      G.run.attached = reviewAttachments(tasks, items, choices);
      resolve(attachPoints(G.run.attached));
    };
    const turnPage = (next) => { page = next; paint(world.desk); };

    setScreen(world.desk, (s) => {
      const { k, W, H } = s;
      const role = tasks[task], prompt = EVIDENCE[role];
      const selected = choices[role];
      const start = page * pageSize;
      UI.bg(s);
      UI.header(s, "Evidências do relatório · " + prompt.label, n + "/" + n);
      UI.text(s, prompt.question, 24 * k, 68 * k, { size: 23, weight: "bold", maxW: W - 48 * k });
      UI.text(s, selected === undefined ? "Escolha uma observação ou prossiga para deixar este papel em aberto." :
        "Selecionada: " + items[selected].where + " · " + items[selected].observation, 24 * k, 101 * k,
        { size: 16, maxW: W - 48 * k, maxLines: 1, color: "#46566E" });
      const bw = (W - 62 * k) / 2;
      items.slice(start, start + pageSize).forEach((item, i) => {
        const index = start + i;
        const bx = 24 * k + (i % 2) * (bw + 14 * k), by = (139 + Math.floor(i / 2) * 88) * k;
        UI.btn(s, bx, by, bw, 81 * k, item.where + " · " + item.observation, () => {
          if (submitting) return;
          if (choices[role] === index) delete choices[role];
          else choices[role] = index;
          paint(world.desk);
        }, { kind: selected === index ? "sel" : "opt", key: "Digit" + (i + 1), size: 18, maxLines: 3 });
      });

      const pageY = H - 144 * k;
      if (page > 0) UI.btn(s, 24 * k, pageY, 185 * k, 46 * k, "← Observações", () => turnPage(page - 1), { key: "ArrowLeft", size: 18 });
      UI.text(s, "Página " + (page + 1) + "/" + pageCount, W / 2, pageY + 7 * k, { size: 18, align: "center" });
      if (page + 1 < pageCount) UI.btn(s, W - 209 * k, pageY, 185 * k, 46 * k, "Observações →", () => turnPage(page + 1), { key: "ArrowRight", size: 18 });
      if (task > 0) UI.btn(s, 24 * k, H - 81 * k, 202 * k, 60 * k, "← Papel anterior", () => {
        if (submitting) return;
        task--;
        page = 0;
        paint(world.desk);
      }, { size: 19 });
      UI.text(s, "Papel " + (task + 1) + "/" + tasks.length, W / 2, H - 63 * k, { size: 18, align: "center" });
      UI.btn(s, W - 282 * k, H - 81 * k, 258 * k, 60 * k,
        task === tasks.length - 1 ? "Entregar relatório →" : "Próximo papel →", moveTask, { kind: "primary", center: true, size: 21 });
    });
  });
}

function reportLines(c, date, lvTitle) {
  const g = c.game, L = [];
  const { severity, impact, findings } = reportSections(g, G.run.reportAnswers);
  const H2 = (t) => L.push({ t, size: 25, weight: "bold", color: "#B54800", gap: 12 }), P = (t, o) => L.push({ t, size: 21, ...(o || {}) });
  L.push({ t: "Relatório de Issue · Teste de Campo", size: 32, weight: "bold" });
  P(`Desafio ${pad2(c.num)} · NovaLink Telecom / Site Delta · ${date}`, { color: "#46566E" });
  H2("1. Identificação");
  P("Título: " + g.title + ".");
  if (severity) {
    P("Severidade: " + severity.answer);
    if (!severity.right) P("Severidade de referência: " + severity.expected);
  }
  if (impact) P("Impacto: " + impact);
  P("Reportado por: " + save.name + " · " + lvTitle);
  H2("2. Aparelhos e bancada");
  P("DUT: " + [...new Set(c.scenarios.filter((s) => !isRef(s)).map(devName))].join(", ") + " · CDUT: " + [...new Set(c.scenarios.filter(isRef).map(devName))].join(", "));
  P("Materiais: " + G.run.eq.selected.map((k) => EQUIPMENT[k].name).join(", "));
  H2("3. Ambiente e cenário"); c.sideInfo.forEach((s) => P(`${s.label}: ${s.value}`)); G.run.setupLog.forEach((s) => P("• " + s));
  if (G.run.fieldSamples.length) P("Medições de campo no mapa 3D usam estimativas de RF da simulação.");
  H2("4. Reprodutibilidade");
  c.scenarios.forEach((scenario) => {
    const review = G.run.tests[scenario.id];
    P(scenario.label + " · Referência: " + scenario.status + " · Seu veredito: " +
      (review.verdict === "pass" ? "Aprovado" : "Falha") + (review.correct ? " ✔" : " ✗"),
    { color: review.correct ? "#15724a" : "#c63b3b" });
    const metric = scenario.metrics[review.evidence];
    P("Observação escolhida (" + EVIDENCE[metric.evidence].label + "): " + metric.observation);
    review.fieldSamples.forEach((sample) => P("Campo 3D · " + fieldLine(sample), { color: "#46566E" }));
    if (scenario.notice) P(scenario.notice, { color: "#46566E" });
  });
  H2("5. Análise");
  findings.forEach((answer) => {
    P(answer.question, { weight: "bold" });
    P("Sua resposta: " + answer.answer);
    if (!answer.right) P("Resposta de referência: " + answer.expected);
    P(answer.explanation, { color: "#46566E" });
  });
  H2("6. Evidências anexas");
  for (const { role, item, correct } of G.run.attached) {
    P(EVIDENCE[role].label, { weight: "bold" });
    if (!item) P("Sem observação anexada.", { color: "#46566E" });
    else {
      P(item.where + " · " + item.observation);
      if (!correct) P("Papel dessa observação: " + EVIDENCE[item.evidence].label, { color: "#B54800" });
    }
  }
  return L;
}
function reportHtml(lines) {
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${esc(lines[0].t)}</title><style>body{font:15px/1.5 Georgia,serif;color:#0A192F;background:#F4F6F9;padding:24px}main{max-width:860px;margin:auto;background:#fff;padding:32px;border-top:4px solid #FF6B00;border-radius:8px}h1{font-family:Arial,sans-serif}h2{font:bold 17px Arial,sans-serif;color:#B54800;margin:20px 0 6px}</style></head><body><main>`
    + lines.map((l, i) => (i === 0 ? `<h1>${esc(l.t)}</h1>` : l.size === 25 ? `<h2>${esc(l.t)}</h2>` : `<p style="margin:2px 0;color:${l.color || "#0A192F"};${l.weight ? "font-weight:bold" : ""}">${esc(l.t)}</p>`)).join("") + `</main></body></html>`;
}
function finalize() {
  const c = G.run.ch;
  for (const scenario of c.scenarios) {
    const review = evaluateTest(scenario, G.run.tests[scenario.id]);
    G.run.tests[scenario.id] = review;
    G.run.score.tests += review.points;
  }
  const total = G.run.score.setup + G.run.score.tests + G.run.score.report;
  const p = save.progress[c.id], first = !(p && p.completed);
  const { stars, coins, progress } = runReward(total, G.run.max, p);
  const lvBefore = levelOf(save.xp);
  save.coins += coins; save.xp += total;
  const lvAfter = levelOf(save.xp);
  save.progress[c.id] = progress;
  persist(); hud();
  const date = new Intl.DateTimeFormat("pt-BR", { dateStyle: "long" }).format(new Date());
  const lines = reportLines(c, date, LEVELS[lvAfter].title);
  const score = { ...G.run.score };
  const finish = () => { emit("run:finished", { ch: c, total, coins }); G.run = null; setPhase("board"); clearBench(); G.deskState = null; npc.cooldown = 0; idleTV(); hud(); setMode("free"); toast("Chamado encerrado. A Lia tem novidades para você.", "good"); };
  const download = () => {
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([reportHtml(lines)], { type: "text/html" }));
    a.download = `relatorio-desafio-${c.num}.html`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); toast("Relatório baixado", "good");
  };
  let page = -1;
  // paginação do relatório para caber no monitor
  const pages = []; {
    const s = world.desk, k = s.k, maxY = s.H - 110 * k; let cur = [], y = 80 * k;
    lines.forEach((l) => { const n = UI.lineHeightFor(s, l.t, l.size, s.W - 60 * k), h = (n * l.size * 1.3 + (l.gap || 2)) * k; if (y + h > maxY && cur.length) { pages.push(cur); cur = []; y = 80 * k; } cur.push(l); y += h; });
    if (cur.length) pages.push(cur);
  }
  G.deskState.canLeave = false;
  setScreen(world.desk, (s) => {
    const k = s.k, W = s.W, x = s.x;
    UI.bg(s);
    if (page < 0) {
      UI.header(s, `Desafio ${pad2(c.num)} concluído · relatório enviado`, save.name);
      x.font = `bold ${90 * k}px ${FONT}`; x.textAlign = "left"; x.fillStyle = "#F2A900"; x.fillText("★".repeat(stars), 30 * k, 180 * k);
      x.fillStyle = "#C9D1DD"; x.fillText("★".repeat(3 - stars), 30 * k + x.measureText("★".repeat(stars)).width, 180 * k);
      [["Laboratório", score.setup], ["Testes", score.tests], ["Relatório", score.report], ["Total", `${total}/${G.run ? G.run.max : maxScore(c)}`]].forEach(([a, b], i) => {
        const bw = (W - 60 * k - 3 * 14 * k) / 4, bx = 30 * k + i * (bw + 14 * k);
        UI.card(s, bx, 220 * k, bw, 110 * k, i === 3 ? "#FFF1E6" : "#FFFFFF", i === 3 ? "#FF6B00" : "#C9D1DD");
        UI.text(s, a.toUpperCase(), bx + 18 * k, 232 * k, { size: 20, color: "#46566E" }); UI.text(s, String(b), bx + 18 * k, 266 * k, { size: 38, weight: "bold" });
      });
      let y = UI.text(s, `+🪙 ${coins} para a loja${first ? "" : " (rejogada: diferença do recorde + 35%)"}`, 30 * k, 352 * k, { size: 32, weight: "bold" });
      if (lvAfter > lvBefore) UI.text(s, `🎉 Promoção! Agora você é ${LEVELS[lvAfter].title}.`, 30 * k, y + 10 * k, { size: 28, weight: "bold", color: "#9a6100" });
      const bw = (W - 60 * k - 2 * 16 * k) / 3, by = s.H - 110 * k;
      UI.btn(s, 30 * k, by, bw, 76 * k, "Ver relatório", () => { page = 0; paint(world.desk); }, { kind: "ghost", center: true, key: "KeyR" });
      UI.btn(s, 30 * k + bw + 16 * k, by, bw, 76 * k, "Baixar relatório (.html)", download, { kind: "ghost", center: true, key: "KeyD" });
      UI.btn(s, 30 * k + 2 * (bw + 16 * k), by, bw, 76 * k, "Concluir chamado ✓", finish, { kind: "primary", center: true });
      return;
    }
    UI.header(s, "Relatório de issue", `página ${page + 1}/${pages.length}`);
    let y = 74 * k;
    pages[page].forEach((l) => { y = UI.text(s, l.t, 30 * k, y + (l.gap || 2) * k, { size: l.size, weight: l.weight, color: l.color, maxW: W - 60 * k }) - l.size * 0.25 * k; });
    const by = s.H - 90 * k;
    UI.btn(s, 30 * k, by, 200 * k, 66 * k, "◀ Anterior", () => { page = Math.max(-1, page - 1); paint(world.desk); }, { kind: "ghost", center: true, key: "ArrowLeft" });
    if (page < pages.length - 1) UI.btn(s, 246 * k, by, 200 * k, 66 * k, "Próxima ▶", () => { page++; paint(world.desk); }, { kind: "ghost", center: true, key: "ArrowRight" });
    UI.btn(s, W - 330 * k, by, 300 * k, 66 * k, "Voltar ao resumo", () => { page = -1; paint(world.desk); }, { kind: "primary", center: true });
  });
}

// estação e modo deste módulo (game/registry.js)
registerStation("desk", { label: () => "Sentar no desktop", open: openDesk });
registerMode("desk", { escape: () => { if (G.deskState && G.deskState.canLeave) setMode("free"); } });
