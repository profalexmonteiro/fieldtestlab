// Ponto de entrada: dados do FieldTestLab, depois os módulos na mesma ordem do jogo original.
import "./core/base.js";
import "./core/renderer.js";
import "./ui/screens.js";
import "./world/sky.js";
import "./world/world.js";
import "./net/network.js";
import "./world/sites.js";
import "./world/coreRacks.js";
import "./world/outside.js";
import "./world/lab.js";
import "./world/characters.js";
import "./rig/arms.js";
import "./rig/tablet.js";
import "./world/benchProps.js";
import "./core/tweens.js";
import "./game/modes.js";
import "./core/input.js";
import "./ui/objective.js";
import "./screens/tv.js";
import "./game/npc.js";
import "./screens/cabinet.js";
import "./game/climb.js";
import "./game/car.js";
import "./screens/rack.js";
import "./screens/coreMonitor.js";
import "./screens/shop.js";
import "./screens/quiz.js";
import "./game/bench.js";
import "./game/analysis.js";
import "./screens/desk.js";
import "./core/loop.js";
import { G } from "./core/store.js";
import { $, CHALLENGES, hud, persist, save, toast } from "./core/base.js";
import { renderer, resize } from "./core/renderer.js";
import { world } from "./world/world.js";
import { SITES, missingCells, siteById, siteCfg } from "./net/network.js";
import { refreshRruLabels } from "./world/coreRacks.js";
import { stations } from "./world/lab.js";
import { npc, player, rebuildPlayer } from "./world/characters.js";

import { activeScreens } from "./core/input.js";
import { interact, refreshObjective, refreshPrompt } from "./ui/objective.js";
import { idleTV, startDialog } from "./game/npc.js";
import { cabToggle } from "./screens/cabinet.js";
import { climbAction } from "./game/climb.js";
import { exitCar } from "./game/car.js";
import { doBenchAction } from "./game/bench.js";
import { setMode } from "./game/modes.js";
import { campaignScreen } from "./screens/campaign.js";
import { camPos, loop } from "./core/loop.js";
import { mode, phase } from "./game/state.js";

// ======================================================================
// Inicialização
// ======================================================================
resize(); rebuildPlayer(); hud(); idleTV(); refreshObjective(); refreshPrompt(true);
camPos.set(player.pos.x, 5.2, player.pos.z + 8.5);
renderer.init().then(() => {
  G.backendName = renderer.backend && renderer.backend.isWebGPUBackend ? "WebGPU" : "WebGL 2";
  hud(); $("#loading").hidden = true;
  renderer.setAnimationLoop(loop);
  toast((save.name ? "Bom turno, " + save.name + "! " : "") + "Entre no laboratório · renderizador " + G.backendName, "good");
}).catch((err) => { $("#loading").textContent = "Não foi possível iniciar o renderizador 3D: " + (err && err.message); });

// gancho para testes automatizados
window.__ftq = {
  get phase() { return phase; }, get mode() { return mode; }, get run() { return G.run; }, get busy() { return G.busy; }, get benchView() { return G.benchView; }, get backend() { return G.backendName; },
  player, stations, npc, interact, doBenchAction, climbAction, cabToggle, startDialog, SITES, missingCells, car: world.car, exitCar,
  setRru(id, i, op, band) { const s = siteById(id), c = siteCfg(s); c[i] = [op, band]; save.sites = save.sites || {}; save.sites[id] = c; persist(); refreshRruLabels(s); },
  press(re) { for (const s of activeScreens()) { const b = s.buttons.find((bt) => !bt.disabled && re.test(bt.text)); if (b) { b.onClick(); return true; } } return false; },
  buttons() { return activeScreens().flatMap((s) => s.buttons.map((b) => b.text)); },
  screen: (name) => world[name],
  // abre a planilha da campanha no monitor do desktop (testes do teste de KPI)
  openCampaign(id = "desafio-7") { setMode("desk"); return campaignScreen(world.desk, CHALLENGES.find((c) => c.id === id).campaign, "teste"); }
};
