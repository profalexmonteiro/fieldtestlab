import * as THREE from "three/webgpu";
import { G } from "../core/store.js";
import { CHALLENGES, LEVELS, PTS, devName, esc, hud, isRef, levelOf, pad2, persist, save, shuffle, toast } from "../core/base.js";
import { FONT, UI, paint, setScreen } from "../ui/screens.js";
import { world } from "../world/world.js";
import { npc } from "../world/characters.js";
import { rig } from "../rig/arms.js";
import { clearBench } from "../world/benchProps.js";
import { addScore, maxScore, mouseClick, restHands, setMode } from "../game/modes.js";
import { idleTV } from "../game/npc.js";
import { quizScreen } from "./quiz.js";
import { EQUIPMENT } from "../data/index.js";
import { attachPoints, runReward } from "../rules/score.js";
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
    await quizScreen(world.desk, q, { title: `Relatório de issue · Desafio ${pad2(G.run.ch.num)}`, right: `${i + 1}/${n}` },
      (frac, right) => { addScore("report", Math.round(PTS.report * frac)); G.run.reportAnswers[i] = { q: q.q, answer: q.options[0], right }; }, mouseClick);
  }
  await attachScreen(n);
  finalize();
}
function attachScreen(n) {
  return new Promise((resolve) => {
    const proofs = [], decoys = [];
    G.run.ch.scenarios.forEach((s) => s.metrics.forEach((m) => { const it = { ...m, where: s.label }; if (s.statusClass === "bad" && m.tone === "bad-text") proofs.push(it); else if (m.tone === "good-text" || m.tone === "accent-text") decoys.push(it); }));
    const pick = shuffle(proofs).slice(0, 4), dec = shuffle(decoys).slice(0, 4);
    const items = shuffle([...pick.map((m) => ({ ...m, proof: true })), ...dec.map((m) => ({ ...m, proof: false }))]);
    const sel = new Set(); let done = false, msg = "";
    const confirm = async () => {
      if (done) return resolve();
      await mouseClick(); done = true; let hit = 0, wrong = 0;
      items.forEach((m, i) => { if (sel.has(i)) m.proof ? hit++ : wrong++; });
      const pts = attachPoints(hit, wrong, pick.length);
      G.run.attached = items.filter((m, i) => sel.has(i)); addScore("report", pts);
      msg = `${hit}/${pick.length} provas anexadas${wrong ? ` · ${wrong} anexo(s) que não comprovam o defeito` : ""} · +${pts} pontos`;
      paint(world.desk);
    };
    setScreen(world.desk, (s) => {
      const k = s.k, W = s.W;
      UI.bg(s); UI.header(s, `Relatório de issue · Desafio ${pad2(G.run.ch.num)}`, `${n}/${n}`);
      UI.text(s, "Anexe as medições que comprovam o defeito do DUT (métricas de contexto ou da referência não comprovam a falha).", 24 * k, 70 * k, { size: 21, weight: "bold", maxW: W - 48 * k, maxLines: 2 });
      const bw = (W - 62 * k) / 2, bh = 96 * k;
      items.forEach((m, i) => {
        const bx = 24 * k + (i % 2) * (bw + 14 * k), by = 128 * k + Math.floor(i / 2) * (bh + 9 * k);
        const kind = done ? (m.proof ? (sel.has(i) ? "ok" : "bad") : sel.has(i) ? "bad" : "dim") : sel.has(i) ? "sel" : "opt";
        UI.btn(s, bx, by, bw, bh, `${m.where} · ${m.label}: ${m.value} (${m.note})`, () => { if (done) return; sel.has(i) ? sel.delete(i) : sel.add(i); mouseClick(); paint(world.desk); }, { kind, key: "Digit" + (i + 1), size: 18, maxLines: 3, disabled: done });
      });
      if (msg) UI.text(s, msg, 24 * k, s.H - 70 * k, { size: 22, weight: "bold", color: "#15724a", maxW: W - 360 * k, maxLines: 2 });
      else UI.text(s, `${sel.size} anexo(s) · clique para marcar ou teclas 1–8`, 24 * k, s.H - 64 * k, { size: 20, color: "#5F6E85" });
      UI.btn(s, W - 320 * k, s.H - 86 * k, 296 * k, 66 * k, done ? "Gerar relatório →" : "Anexar evidências", confirm, { kind: "primary", center: true, size: 22 });
    });
  });
}

function reportLines(c, date, lvTitle) {
  const g = c.game, L = [];
  const H2 = (t) => L.push({ t, size: 25, weight: "bold", color: "#B54800", gap: 12 }), P = (t, o) => L.push({ t, size: 21, ...(o || {}) });
  L.push({ t: "Relatório de Issue · Teste de Campo", size: 32, weight: "bold" });
  P(`Desafio ${pad2(c.num)} · NovaLink Telecom / Site Delta · ${date}`, { color: "#46566E" });
  H2("1. Identificação"); P("Título: " + g.title + "."); P("Severidade: " + g.report[g.report.length - 1].options[0] + "."); P(`Reportado por: ${save.name} · ${lvTitle}`);
  H2("2. Aparelhos e bancada");
  P("DUT: " + [...new Set(c.scenarios.filter((s) => !isRef(s)).map(devName))].join(", ") + " · CDUT: " + [...new Set(c.scenarios.filter(isRef).map(devName))].join(", "));
  P("Materiais: " + G.run.eq.selected.map((k) => EQUIPMENT[k].name).join(", "));
  H2("3. Ambiente e cenário"); c.sideInfo.forEach((s) => P(`${s.label}: ${s.value}`)); G.run.setupLog.forEach((s) => P("• " + s));
  H2("4. Reprodutibilidade");
  c.scenarios.forEach((s) => { const t = G.run.tests[s.id]; P(`${s.label} — caso: ${s.status} — seu veredito: ${t.verdict === "pass" ? "Aprovado" : "Falha"} ${t.correct ? "✔" : "✗"}`, { color: t.correct ? "#15724a" : "#c63b3b" }); });
  H2("5. Análise"); G.run.reportAnswers.slice(0, -1).forEach((a) => { P(a.q, { weight: "bold" }); P(a.answer + (a.right ? "" : " (corrigido pelo revisor)")); });
  H2("6. Evidências anexas");
  if (G.run.attached.length) G.run.attached.forEach((m) => P(`${m.where} · ${m.label}: ${m.value} (${m.note})${m.proof ? "" : " · não comprova o defeito"}`, { color: m.proof ? "#0A192F" : "#5F6E85" }));
  else P("Nenhuma evidência anexada.", { color: "#c63b3b" });
  return L;
}
function reportHtml(lines) {
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${esc(lines[0].t)}</title><style>body{font:15px/1.5 Georgia,serif;color:#0A192F;background:#F4F6F9;padding:24px}main{max-width:860px;margin:auto;background:#fff;padding:32px;border-top:4px solid #FF6B00;border-radius:8px}h1{font-family:Arial,sans-serif}h2{font:bold 17px Arial,sans-serif;color:#B54800;margin:20px 0 6px}</style></head><body><main>`
    + lines.map((l, i) => (i === 0 ? `<h1>${esc(l.t)}</h1>` : l.size === 25 ? `<h2>${esc(l.t)}</h2>` : `<p style="margin:2px 0;color:${l.color || "#0A192F"};${l.weight ? "font-weight:bold" : ""}">${esc(l.t)}</p>`)).join("") + `</main></body></html>`;
}
function finalize() {
  const c = G.run.ch;
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
