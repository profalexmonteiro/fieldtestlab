import * as THREE from "three/webgpu";
import { G } from "../core/store.js";
import { $, esc, pad2 } from "../core/base.js";
import { world } from "../world/world.js";
import { LAB } from "../net/network.js";
import { stations } from "../world/lab.js";
import { npc, player } from "../world/characters.js";
import { setMode } from "../game/modes.js";
import { mode, phase } from "../game/state.js";
import { fieldStatus } from "../game/field.js";
import { modeTypes, stationOf } from "../game/registry.js";
import { on } from "../core/events.js";

// ======================================================================
// Objetivo e dica de ação (HUD discreto, sem pop-ups)
// ======================================================================
const OBJECTIVES = {
  enter: () => ({ t: "Caminhe até o laboratório e entre pela porta.", target: new THREE.Vector3(0, 0, LAB.maxZ + 1.5) }),
  board: () => ({ t: "Fale com a supervisora Lia para receber um chamado.", target: npc.pos }),
  cabinet: () => ({ t: "Vá ao armário e pegue os materiais do teste.", target: stations.cabinet.pos }),
  bench: () => {
    if (G.run.bench.placed && fieldStatus(G.run)?.next) return { t: "Entre no carro e registre os pontos marcados com M antes de capturar na bancada.", target: stations.car.pos };
    return { t: player.carrying ? "Leve os materiais até a bancada de testes." : "Continue os testes na bancada.", target: stations.bench.pos };
  },
  return: () => (player.carrying ? { t: "Devolva os materiais ao armário.", target: stations.cabinet.pos } : { t: "Recolha os materiais da bancada na caixa.", target: stations.bench.pos }),
  report: () => ({ t: "Vá ao desktop da estação de relatório e escreva o relatório.", target: stations.desk.pos })
};
const MODE_TEXT = {
  npc: "Converse com a supervisora: clique nas opções do balão.", tv: "Leia o chamado na TV.", cabinet: "Clique nos itens das prateleiras para selecionar.",
  climb: "Na escada: W/S para subir e descer. No topo, inspecione as RRUs.", rru: "Inspeção das RRUs no tablet.", shop: "Escolha um uniforme no espelho digital.",
  rack: "Configure operadora e banda de cada RRU no monitor do rack.", desk: "Responda no monitor do desktop (clique ou teclas A–D)."
};
function refreshObjective() {
  const o = OBJECTIVES[phase]();
  let extra = "";
  if (G.run) extra = `<div class="sc">Desafio ${pad2(G.run.ch.num)} · ${esc(G.run.ch.game.short)} · telefones testados ${Object.keys(G.run.tests).length}/${G.run.ch.scenarios.length}</div>`;
  const md = modeTypes[mode];
  const txt = (md && md.objective && md.objective()) || (mode === "rack" && world.rackText) || MODE_TEXT[mode] || o.t;
  $("#objective").innerHTML = `<small>Objetivo</small>${esc(txt)}${extra}`;
  world.target = md?.target ? md.target() : o.target;
}
function nearest() {
  let best = null, bd = 1.9;
  for (const [k, s] of Object.entries(stations)) {
    const d = Math.hypot(player.pos.x - s.pos.x, player.pos.z - s.pos.z);
    if (d < bd) { bd = d; best = k; }
  }
  return best;
}
let lastPromptKey = "";
function refreshPrompt(force) {
  const pr = $("#prompt");
  let key, html = "";
  const md = modeTypes[mode], p = md && md.prompt ? md.prompt() : null;
  if (p) ({ key, html } = p);
  else if (mode === "free") {
    const n = nearest(); key = "st:" + n + phase + player.carrying + player.epi;
    html = n ? `<button id="pAct"><kbd>E</kbd>${esc(stationOf(n).label(n))}</button>` : "";
  } else { key = "none:" + mode; }
  if (key === lastPromptKey && !force) return;
  lastPromptKey = key; pr.innerHTML = html;
  const act = $("#pAct"), ex = $("#pExit");
  $("#pMeasure")?.addEventListener("click", () => modeTypes[mode]?.measure?.());
  if (act) act.addEventListener("click", () => { const m = modeTypes[mode]; if (m && m.primary) m.primary(); else interact(nearest()); });
  if (ex) ex.addEventListener("click", () => { if (G.busy) return; const m = modeTypes[mode]; if (m && m.escape) m.escape(); else setMode("free"); });
}
function interact(k) {
  if (!k) return;
  stationOf(k).open(k);
}


// objetivo e dica acompanham as máquinas de estado
on("mode:changed", () => { refreshObjective(); refreshPrompt(true); });
on("phase:changed", () => { refreshObjective(); refreshPrompt(true); });
on("benchView:changed", () => refreshPrompt(true));

export { interact, refreshObjective, refreshPrompt };
