import { G } from "../core/store.js";
import { hud, pad2, persist, save, toast, unlockedChallenges } from "../core/base.js";
import { camera, collide, roundRect } from "../core/renderer.js";
import { FONT, UI, setScreen } from "../ui/screens.js";
import { LAB, REQUIRED_CELLS, cellName, missingCells } from "../net/network.js";
import { npc, player } from "../world/characters.js";
import { _v, _v2, camBasis } from "../rig/arms.js";
import { maxScore, setMode } from "./modes.js";
import { nameInput } from "../core/input.js";
import { tvRender } from "../screens/tv.js";
import { mode, phase, setPhase } from "./state.js";
import { registerMode, registerStation } from "./registry.js";
import { emit } from "../core/events.js";

// ======================================================================
// NPC: a supervisora vem até o engenheiro e entrega o chamado no balão
// ======================================================================
let dialog = null;
function npcUpdate(dt) {
  const toPlayer = _v.subVectors(player.pos, npc.pos); toPlayer.y = 0;
  const dist = toPlayer.length();
  npc.cooldown = Math.max(0, npc.cooldown - dt);
  const insideLab = player.pos.z < LAB.maxZ && player.pos.z > LAB.minZ && player.pos.x > LAB.minX && player.pos.x < LAB.maxX;
  const wantsTalk = (phase === "board" && !G.run) || !save.name;
  if (mode === "npc") npc.state = "talk";
  else if (npc.state === "talk") npc.state = "return";
  else if (wantsTalk && insideLab && npc.cooldown <= 0 && (npc.state === "idle" || npc.state === "approach") && dist > 1.7) npc.state = "approach";
  else if (npc.state === "approach" && dist <= 1.7) npc.state = "wait";
  else if ((npc.state === "wait" || npc.state === "approach") && (!insideLab || !wantsTalk || dist > 9)) npc.state = "return";

  let moving = false;
  if (npc.state === "approach" || npc.state === "return" || (npc.state === "talk" && dist > 1.8)) {
    const target = npc.state === "return" ? npc.home : player.pos;
    const d = _v2.subVectors(target, npc.pos); d.y = 0;
    const stopAt = npc.state === "return" ? 0.05 : 1.6;
    if (d.length() > stopAt) {
      d.normalize(); const sp = 1.9 * dt;
      // desvio simples: tenta a direção direta e depois ângulos crescentes para contornar a bancada
      // mantém o lado do desvio até contornar o obstáculo (evita oscilar)
      const s = npc.detour || 1;
      for (const a of [0, s * 0.6, s * 1.2, s * 1.8, s * 2.4, -s * 0.6, -s * 1.2, -s * 1.8]) {
        const cx = d.x * Math.cos(a) - d.z * Math.sin(a), cz = d.x * Math.sin(a) + d.z * Math.cos(a);
        const nx = npc.pos.x + cx * sp, nz = npc.pos.z + cz * sp;
        if (!collide(nx, nz, 0.3)) { npc.pos.x = nx; npc.pos.z = nz; npc.rot = Math.atan2(cx, cz); moving = true; npc.detour = a === 0 ? (npc.detourHold > 0 ? s : 0) : Math.sign(a); npc.detourHold = a === 0 ? Math.max(0, (npc.detourHold || 0) - dt) : 0.6; break; }
      }
      npc.walk += sp * 2.4;
    } else if (npc.state === "return") { npc.state = "idle"; }
  }
  if (npc.state === "wait" || npc.state === "talk") npc.rot = Math.atan2(toPlayer.x, toPlayer.z);
  else if (npc.state === "idle") npc.rot += (0 - npc.rot) * Math.min(1, dt * 3);
  const p = npc.parts, sw = moving ? Math.sin(npc.walk) * 0.6 : 0;
  p.legL.rotation.x = sw; p.legR.rotation.x = -sw;
  p.armL.rotation.x = npc.state === "talk" ? -0.9 : -sw * 0.7;
  p.armR.rotation.x = npc.state === "talk" ? -1.2 + Math.sin(G.elapsed * 3) * 0.35 : npc.state === "wait" ? -2.7 + Math.sin(G.elapsed * 7) * 0.3 : sw * 0.7;
  p.mouth.scale.y = npc.state === "talk" ? 1 + Math.abs(Math.sin(G.elapsed * 12)) * 2.5 : 1;
  npc.model.position.set(npc.pos.x, 0, npc.pos.z); npc.model.rotation.y = npc.rot;
  npc.alert.visible = npc.state === "wait" && mode !== "npc";
  npc.alert.position.set(npc.pos.x, 2.55 + Math.sin(G.elapsed * 4) * 0.06, npc.pos.z);
  npc.tag.position.set(npc.pos.x, 2.25, npc.pos.z); npc.tag.visible = mode !== "npc";
  if (mode === "npc") {
    const b = camBasis(camera.position, camera.quaternion);
    npc.bubble.mesh.position.set(npc.pos.x, 1.95, npc.pos.z).addScaledVector(b.right, 0.95);
    npc.bubble.mesh.quaternion.copy(camera.quaternion);
  }
}
function bubbleRender(title, body, buttons, extra) {
  setScreen(npc.bubble, (s) => {
    const k = s.k, x = s.x, W = s.W, Hh = s.H;
    x.clearRect(0, 0, W, Hh);
    UI.card(s, 6, 6, W - 12, Hh - 12, "#FFFFFF", "#FF6B00");
    x.fillStyle = "#0A192F"; roundRect(x, 6, 6, W - 12, 70 * k, 12 * k); x.fill();
    x.fillStyle = "#FF6B00"; x.font = `bold ${30 * k}px ${FONT}`; x.textAlign = "left"; x.fillText("Lia · supervisora do laboratório", 28 * k, 52 * k);
    let y = 92 * k;
    if (title) y = UI.text(s, title, 28 * k, y, { size: 32, weight: "bold", maxW: W - 56 * k, maxLines: 2 });
    y = UI.text(s, body, 28 * k, y + 6 * k, { size: 27, color: "#2b3b52", maxW: W - 56 * k, maxLines: 6 });
    if (extra) y = extra(s, y);
    const n = buttons.length, gap = 14 * k, bw = (W - 56 * k - gap * (n - 1)) / n, by = Hh - 96 * k;
    buttons.forEach((b, i) => UI.btn(s, 28 * k + i * (bw + gap), by, bw, 70 * k, b.t, b.fn, { kind: b.kind || (i === 0 ? "primary" : "ghost"), center: true, key: b.key, size: 25 }));
  });
}
function startDialog() {
  if (mode !== "free") return;
  npc.state = "talk"; setMode("npc");
  const pending = unlockedChallenges().filter((c) => !(save.progress[c.id] || {}).completed);
  G.offerIdx = Math.max(0, unlockedChallenges().indexOf(pending[0] || unlockedChallenges().slice(-1)[0]));
  if (!save.name) return askName();
  if (G.run) return statusTalk();
  offerTalk();
}
function askName() {
  nameInput.value = ""; nameInput.focus();
  const draw = () => bubbleRender("Olá! Sou a Lia, supervisora do laboratório.", "Seja bem-vindo à equipe de Field Test. Como você se chama? Digite seu nome e confirme.",
    [{ t: "Confirmar nome", fn: confirmName, kind: "primary" }],
    (s, y) => { const k = s.k; UI.card(s, 28 * k, y + 12 * k, s.W - 56 * k, 70 * k, "#F4F6F9", "#FF6B00"); UI.text(s, (nameInput.value || "") + (Math.floor(G.elapsed * 2) % 2 ? "|" : " "), 46 * k, y + 22 * k, { size: 32, weight: "bold" }); return y + 90 * k; });
  dialog = { page: "name", draw }; draw();
}
function confirmName() {
  const v = nameInput.value.trim(); if (!v) { nameInput.focus(); return; }
  save.name = v.slice(0, 24); persist(); hud(); nameInput.blur(); idleTV();
  toast("Crachá emitido: " + save.name, "good");
  if (G.run) statusTalk(); else offerTalk();
}
nameInput.addEventListener("input", () => { if (dialog && dialog.page === "name") dialog.draw(); });
nameInput.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); confirmName(); } if (e.key === "Escape") { nameInput.blur(); endDialog(); } });
function offerTalk() {
  const list = unlockedChallenges(), c = list[G.offerIdx % list.length];
  npc.offering = c; tvRender(false);
  const p = save.progress[c.id];
  const btns = [{ t: "Aceitar chamado", fn: () => acceptChallenge(c), key: "Digit1" }];
  if (list.length > 1) btns.push({ t: "Outro chamado ▸", fn: () => { G.offerIdx++; offerTalk(); }, key: "Digit2" });
  btns.push({ t: "Agora não", fn: endDialog, key: "Digit3" });
  dialog = { page: "offer" };
  bubbleRender(`${save.name}, chegou o Desafio ${pad2(c.num)}: ${c.game.short}${p && p.completed ? " (rejogar)" : ""}`,
    `${c.game.brief} São ${c.scenarios.length} testes. Rede necessária: ${(REQUIRED_CELLS[c.id] || []).map(cellName).join(", ")}.` + (missingCells(c).length ? ` Fora do ar agora: ${missingCells(c).map(cellName).join(", ")} (configure no rack de um site).` : ""), btns);
}
function statusTalk() {
  dialog = { page: "status" };
  const next = phase === "cabinet" ? "pegar os materiais no armário" : phase === "bench" ? "terminar os testes na bancada" : phase === "return" ? (player.carrying ? "devolver os materiais ao armário" : "recolher os materiais da bancada e devolvê-los ao armário") : "escrever o relatório no desktop";
  bubbleRender(`Desafio ${pad2(G.run.ch.num)} em andamento`, `Você está no ${G.run.ch.game.short}. Próximo passo: ${next}. Para subir na torre, use o EPI do armário.`, [{ t: "Certo!", fn: endDialog }]);
}
function acceptChallenge(c) {
  G.run = { ch: c, score: { setup: 0, tests: 0, report: 0 }, max: maxScore(c), setupLog: [], eq: null, tests: {}, reportAnswers: [], attached: [], bench: { placed: false, configured: false, idx: 0, sub: 0 } };
  setPhase("cabinet"); npc.offering = null; tvRender(false); hud(); emit("run:accepted", { ch: c });
  dialog = { page: "go" };
  bubbleRender("Combinado!", `O briefing do Desafio ${pad2(c.num)} fica na TV. Pegue os materiais no armário, monte tudo na bancada e depois escreva o relatório no desktop.`, [{ t: "Vamos lá", fn: endDialog }]);
}
function endDialog() {
  dialog = null; npc.offering = null; nameInput.blur();
  npc.cooldown = 25; npc.state = "return";
  if (!G.run) idleTV(); else tvRender(false);
  setMode("free");
}
function idleTV() { if (!G.run && !npc.offering) tvRender(false); }


// estação e modo deste módulo (game/registry.js)
registerStation("npc", { label: () => "Falar com a supervisora Lia", open: startDialog });
registerMode("npc", { escape: () => endDialog() });

export { dialog, idleTV, npcUpdate, startDialog };
