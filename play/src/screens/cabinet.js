import * as THREE from "three/webgpu";
import { G } from "../core/store.js";
import { PTS, pad2, shuffle, toast } from "../core/base.js";
import { box, cyl, label, mat } from "../core/renderer.js";
import { world } from "../world/world.js";
import { player } from "../world/characters.js";
import { refreshObjective, refreshPrompt } from "../ui/objective.js";
import { addScore, setMode } from "../game/modes.js";
import { EQUIPMENT } from "../data/index.js";
import { equipmentScore } from "../rules/score.js";
import { ease, tween } from "../core/tweens.js";
import { mode, phase, setPhase } from "../game/state.js";
import { registerMode, registerStation } from "../game/registry.js";

// ======================================================================
// Armário: portas abrem e os itens ficam nas prateleiras; clicar seleciona. Conferência pela barra de ação (E / Esc).
// ======================================================================
const EPI_ITEM = { icon: "🦺", name: "EPI para trabalho em altura", desc: "Capacete com jugular, cinto paraquedista e talabarte. Obrigatório para subir na torre." };
const ITEM_SHORT = { modemlog: "Notebook · log", cdut: "CDUT", sims: "SIMs", ims: "Conta IMS", remote: "Terminal remoto", audio: "Áudio", route: "Drive test", emerg: "Autorização 112", gps: "GPS", spectrum: "Espectro", thermal: "Térmica", battery: "Bateria", camera: "Lab câmera", epi: "EPI" };
const itemInfo = (k) => (k === "epi" ? EPI_ITEM : EQUIPMENT[k]);
let cabState = null;
function makeItem(k) {
  const g = new THREE.Group();
  const B = (w, h, d, c, x, y, z) => box(w, h, d, c, x, y, z, g);
  const lens = (r, h, c, y, z) => { const l = cyl(r, r, h, c, 0, 0, 0, g); l.rotation.x = Math.PI / 2; l.position.set(0, y, z); };
  switch (k) {
    case "modemlog": B(0.36, 0.03, 0.25, "#9AA6B8", 0, 0, 0); B(0.36, 0.012, 0.25, "#46566E", 0, 0.03, 0); B(0.06, 0.006, 0.03, "#FF6B00", 0.1, 0.042, 0.08); break;
    case "cdut": case "remote": B(0.1, 0.2, 0.014, "#0A192F", 0, 0, 0); B(0.085, 0.17, 0.004, k === "cdut" ? "#B6E0CB" : "#9fc4ff", 0, 0.015, 0.009); B(0.12, 0.02, 0.06, "#46566E", 0, 0, -0.02); break;
    case "sims": B(0.16, 0.1, 0.01, "#F4F6F9", 0, 0, 0); B(0.03, 0.025, 0.012, "#C9A15A", -0.03, 0.05, 0.002); B(0.03, 0.025, 0.012, "#C9A15A", 0.03, 0.05, 0.002); break;
    case "ims": B(0.32, 0.09, 0.24, "#2f63c9", 0, 0, 0); for (let i = 0; i < 4; i++) B(0.02, 0.02, 0.01, "#3bd17a", -0.12 + i * 0.04, 0.035, 0.12); break;
    case "audio": { const band = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.012, 6, 16, Math.PI), mat("#0A192F")); band.position.y = 0.07; g.add(band); [-0.09, 0.09].forEach((x) => B(0.04, 0.08, 0.07, "#0A192F", x, 0.03, 0)); break; }
    case "route": B(0.26, 0.07, 0.13, "#FF6B00", 0, 0.03, 0); B(0.14, 0.05, 0.12, "#F4F6F9", -0.02, 0.1, 0); [-0.08, 0.08].forEach((x) => [-0.066, 0.066].forEach((z) => B(0.05, 0.05, 0.02, "#1b1f27", x, 0, z))); break;
    case "emerg": B(0.22, 0.28, 0.03, "#c63b3b", 0, 0, 0); B(0.1, 0.03, 0.005, "#FFFFFF", 0, 0.125, 0.016); B(0.03, 0.1, 0.005, "#FFFFFF", 0, 0.09, 0.016); break;
    case "gps": cyl(0.07, 0.08, 0.035, "#0A192F", 0, 0, 0, g); cyl(0.006, 0.006, 0.12, "#46566E", 0.04, 0.035, 0, g, 4); break;
    case "spectrum": B(0.3, 0.18, 0.2, "#172A45", 0, 0, 0); B(0.16, 0.1, 0.004, "#6FD3FF", -0.05, 0.05, 0.101); for (let i = 0; i < 3; i++) B(0.025, 0.025, 0.01, "#FF6B00", 0.08, 0.04 + i * 0.04, 0.1); break;
    case "thermal": B(0.12, 0.14, 0.1, "#FFC21A", 0, 0, 0); lens(0.035, 0.05, "#0A192F", 0.09, 0.07); break;
    case "battery": B(0.2, 0.12, 0.12, "#15724a", 0, 0, 0); B(0.03, 0.02, 0.03, "#c63b3b", -0.05, 0.12, 0); B(0.03, 0.02, 0.03, "#0A192F", 0.05, 0.12, 0); break;
    case "camera": B(0.16, 0.1, 0.08, "#0A192F", 0, 0, 0); lens(0.032, 0.06, "#46566E", 0.05, 0.06); break;
    case "epi": {
      const hm = new THREE.Mesh(new THREE.SphereGeometry(0.1, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat("#FFC21A")); hm.position.set(-0.08, 0.015, 0); g.add(hm);
      cyl(0.125, 0.125, 0.015, "#FFC21A", -0.08, 0, 0, g);
      B(0.03, 0.24, 0.02, "#FF6B00", 0.07, 0, 0); B(0.03, 0.24, 0.02, "#FF6B00", 0.14, 0, 0); B(0.14, 0.03, 0.03, "#FF6B00", 0.105, 0.1, 0);
      break;
    }
  }
  const e = itemInfo(k);
  const lb = label(e.icon + " " + ITEM_SHORT[k], { scale: 0.2 }); lb.position.set(0, 0.36, 0); g.add(lb);
  const halo = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(0.42, 0.34, 0.3)), new THREE.LineBasicMaterial({ color: "#FF6B00" }));
  halo.position.y = 0.15; halo.visible = false; g.add(halo);
  g.userData = { key: k, halo };
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}
function openCabinet() {
  const cab = world.cab;
  const returning = phase === "return" && player.carrying;
  cabState = { scoring: phase === "cabinet", returning, sel: new Set(), done: false, hover: null, msg: "" };
  cab.items.forEach((g) => cab.group.remove(g)); cab.items = [];
  const eq = shuffle(Object.keys(EQUIPMENT));
  [eq.slice(0, 4), eq.slice(4, 8), eq.slice(8, 11), ["epi", ...eq.slice(11)]].forEach((row, li) => row.forEach((k, i) => {
    const g = makeItem(k);
    g.position.set(-0.08, world.shelfY[li] + 0.005, -1.3 + ((i + 0.5) * 2.6) / row.length); g.rotation.y = -Math.PI / 2; g.userData.baseY = g.position.y;
    if (returning && G.run.eq.selected.includes(k)) g.visible = false;     // ainda está na caixa do engenheiro
    cab.group.add(g); cab.items.push(g);
  }));
  setMode("cabinet");
  updateCabinet();
}
// passar o mouse: contorno branco e a descrição do item na caixa de objetivo do HUD
function cabHover(k) {
  if (!cabState || cabState.hover === k) return;
  cabState.hover = k; updateCabinet();
}
function updateCabinet() {
  const st = cabState; if (!st) return;
  world.cab.items.forEach((g) => {
    const k = g.userData.key, on = k === "epi" ? player.epi : st.sel.has(k), halo = g.userData.halo;
    if (!st.done) {
      halo.visible = (on && k !== "epi") || k === st.hover;
      halo.material.color.set(on ? "#FF6B00" : "#FFFFFF");
      g.position.y = g.userData.baseY + (on ? 0.04 : 0);
    }
    if (k === "epi") g.visible = !player.epi;
    else if (st.returning) halo.visible = halo.visible || !!g.userData.returned;
  });
  refreshObjective(); refreshPrompt(true);
}
function cabinetText() {
  const st = cabState; if (!st) return "";
  if (st.hover) { const h = itemInfo(st.hover); return `${h.icon} ${h.name}: ${h.desc}`; }
  if (st.msg) return st.msg;
  if (st.returning) return "Devolva os materiais: " + G.run.eq.selected.map((c) => ITEM_SHORT[c]).join(" · ") + ". Cada item volta ao seu lugar na prateleira.";
  if (st.scoring) return `Desafio ${pad2(G.run.ch.num)}: clique nos itens das prateleiras para selecionar o que vai levar (o DUT já veio com o chamado). ` +
    (st.sel.size ? "Na caixa: " + [...st.sel].map((c) => ITEM_SHORT[c]).join(" · ") : "Caixa vazia.");
  if (phase === "return") return "Primeiro recolha os materiais da bancada na caixa. Aqui dá para vestir ou devolver o EPI.";
  return phase === "bench" || phase === "report" ? "Os materiais deste chamado já estão com você. Clique no EPI para vestir ou devolver." : "Sem chamado ativo: clique no EPI para vestir. Fale com a Lia para receber um chamado.";
}
function cabinetPrompt() {
  const st = cabState; if (!st) return null;
  if (st.returning) {
    if (st.busy) return { key: "cab:ret:busy", html: `<button class="sec" disabled>⏳ Guardando…</button>` };
    const n = G.run.eq.selected.length;
    return { key: "cab:ret:" + st.done, html: st.done ? `<button id="pAct"><kbd>E</kbd>Fechar armário</button>`
      : `<button id="pAct"><kbd>E</kbd>Devolver ${n} ${n === 1 ? "item" : "itens"} ao armário</button><button class="sec" id="pExit"><kbd>Esc</kbd>Fechar armário</button>` };
  }
  const act = st.scoring ? (st.done ? "Levar à bancada →" : `Conferir e levar ${st.sel.size} ${st.sel.size === 1 ? "item" : "itens"}`) : "";
  return { key: "cab:" + st.scoring + st.done + st.sel.size,
    html: (act ? `<button id="pAct"><kbd>E</kbd>${act}</button>` : "") + (st.done ? "" : `<button class="sec" id="pExit"><kbd>Esc</kbd>Fechar armário</button>`) };
}
function cabToggle(k) {
  const st = cabState; if (!st) return;
  if (k === "epi") {
    player.epi = !player.epi; player.parts.epi.visible = player.epi;
    toast(player.epi ? "EPI vestido: capacete, cinto paraquedista e talabarte" : "EPI devolvido ao armário", player.epi ? "good" : "");
    return updateCabinet();
  }
  if (!st.scoring) return toast(st.returning ? "Use “Devolver itens ao armário” para guardar o que está na caixa." : phase === "return" ? "Recolha primeiro os materiais da bancada." : phase === "bench" || phase === "report" ? "Os materiais deste chamado já estão com você." : "Receba um chamado com a Lia antes de levar equipamentos.", "bad");
  if (st.done) return;
  st.sel.has(k) ? st.sel.delete(k) : st.sel.add(k);
  updateCabinet();
}
// 1º E: confere (contornos verde = certo, vermelho = faltou/desnecessário, cinza = neutro); 2º E: leva à bancada
function cabConfirm() {
  const st = cabState; if (!st) return;
  if (st.returning) return st.done ? closeCabinet(false) : returnItems();
  if (!st.scoring) return closeCabinet(false);
  if (st.done) return closeCabinet(true);
  st.done = true; st.hover = null;
  const g = G.run.ch.game, req = g.equipment.required, neu = g.equipment.neutral, sel = st.sel;
  const { pts, missing, extra } = equipmentScore(req, neu, [...sel]);
  const state = (k) => (req.includes(k) ? (sel.has(k) ? "ok" : "miss") : sel.has(k) ? (neu.includes(k) ? "neutral" : "bad") : "");
  const colors = { ok: "#15724a", miss: "#c63b3b", bad: "#c63b3b", neutral: "#9AA6B8" };
  world.cab.items.forEach((it) => { const s = state(it.userData.key); it.userData.halo.visible = !!s; if (s) it.userData.halo.material.color.set(colors[s]); });
  addScore("setup", pts);
  G.run.eq = { selected: [...new Set([...sel, ...missing])], missing, extra };
  st.msg = `Conferência ${pts}/${PTS.equipment} · ` + (!missing.length && !extra.length ? "Materiais perfeitos! 👌"
    : [missing.length ? `O supervisor completou: ${missing.map((k) => ITEM_SHORT[k]).join(", ")}.` : "", extra.length ? `Desnecessário: ${extra.map((k) => ITEM_SHORT[k]).join(", ")}.` : ""].join(" "));
  toast(st.msg, !missing.length && !extra.length ? "good" : "");
  updateCabinet();
}
// devolução: cada item sai da caixa e volta à sua prateleira (contorno verde); depois segue para o relatório
async function returnItems() {
  const st = cabState; if (!st || st.busy || st.done) return;
  st.busy = true; G.busy = true; refreshPrompt(true);
  for (const g of world.cab.items.filter((it) => !it.visible && it.userData.key !== "epi")) {
    const y1 = g.userData.baseY; g.userData.returned = true; g.visible = true; g.userData.halo.visible = true; g.userData.halo.material.color.set("#15724a");
    g.scale.setScalar(0.01);
    await tween(320, (k) => { const e = ease(k); g.scale.setScalar(0.01 + 0.99 * e); g.position.y = y1 + 0.25 * (1 - e); });
    if (cabState !== st) break;
  }
  G.busy = false; st.busy = false;
  if (cabState !== st) return;
  st.done = true; player.carrying = false; player.parts.crate.visible = false;
  setPhase("report");
  st.msg = "Materiais devolvidos ao armário! Agora escreva o relatório no desktop.";
  toast(st.msg, "good"); updateCabinet();
}
function closeCabinet(took) {
  if (mode !== "cabinet") return;
  if (cabState && cabState.busy) return;
  if (cabState && cabState.scoring && cabState.done) took = true;
  const cab = world.cab;
  if (took) {
    cab.items.forEach((it) => { if (G.run.eq.selected.includes(it.userData.key)) it.visible = false; });
    player.carrying = true; player.parts.crate.visible = true; setPhase("bench");
    toast("Materiais na caixa. Leve até a bancada.", "good");
  }
  cabState = null; setMode("free");
  setTimeout(() => { if (mode !== "cabinet") { cab.items.forEach((g) => cab.group.remove(g)); cab.items = []; } }, 700);
}


// estação e modo deste módulo (game/registry.js)
registerStation("cabinet", { label: () => "Abrir o armário", open: openCabinet });
registerMode("cabinet", { objective: cabinetText, prompt: cabinetPrompt, primary: () => cabConfirm(), escape: () => closeCabinet(false), hover: cabHover, pick: cabToggle });

export { cabConfirm, cabToggle };
