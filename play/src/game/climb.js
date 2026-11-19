import { G } from "../core/store.js";
import { toast } from "../core/base.js";
import { UI, setScreen } from "../ui/screens.js";
import { world } from "../world/world.js";
import { BANDS, pciOf, siteById, siteCfg } from "../net/network.js";
import { stations } from "../world/lab.js";
import { player } from "../world/characters.js";
import { tablet } from "../rig/tablet.js";
import { setMode } from "./modes.js";
import { registerMode, registerStation } from "./registry.js";

// ======================================================================
// Torre: escada (exige EPI) e inspeção das RRUs no tablet
// ======================================================================
G.topNotified = false;
function startClimb(k) {
  const site = siteById((k || "ladder:delta").split(":")[1]);
  world.tower = site.tower;
  if (!player.epi) { toast("Preciso do EPI (capacete, cinto paraquedista e talabarte). Ele fica no armário do laboratório.", "bad"); return; }
  player.climbY = 0; G.topNotified = false;
  player.pos.set(world.tower.x, 0, world.tower.ladderZ + 0.36); player.rot = Math.PI;
  toast("Talabarte conectado na linha de vida. W/S para subir e descer.", "good");
  setMode("climb");
}
function climbAction() {
  if (player.climbY < 0.05) { const st = stations["ladder:" + world.tower.site.id]; player.climbY = 0; player.pos.set(st.pos.x, 0, st.pos.z); return setMode("free"); }
  if (player.climbY >= world.tower.climbMax - 0.02) {
    setScreen(tablet.scr, (s) => {
      const k = s.k, W = s.W;
      const site = world.tower.site, cfg = siteCfg(site);
      UI.bg(s); UI.header(s, `Inspeção · ${site.name} · ${site.kind}`, `${Math.round(world.tower.climbMax + 1.5)} m`);
      cfg.map(([op, band], i) => [`RRU ${i + 1} · setor ${"αβγ"[i]}`, `${op} · ${BANDS[band].name} · PCI ${pciOf(site, i)}`]).forEach(([a, b], i) => {
        const bw = (W - 48 * k - 28 * k) / 3, bx = 24 * k + i * (bw + 14 * k);
        UI.card(s, bx, 80 * k, bw, 104 * k, "#FFFFFF", "#C9D1DD");
        UI.text(s, a, bx + 14 * k, 88 * k, { size: 22, color: "#46566E" }); UI.text(s, b, bx + 14 * k, 124 * k, { size: 25, weight: "bold", maxW: bw - 24 * k, maxLines: 1 });
      });
      UI.text(s, "A RRU converte o sinal digital em RF e amplifica para a antena. A fibra que sobe do rack é a fronthaul (CPRI/eCPRI) até o DU/BBU. Operadora e banda de cada RRU são definidas no monitor do rack, lá embaixo.", 24 * k, 200 * k, { size: 25, color: "#2b3b52", maxW: W - 48 * k, maxLines: 5 });
      UI.btn(s, W - 304 * k, s.H - 100 * k, 280 * k, 76 * k, "Voltar à escada", () => setMode("climb"), { kind: "primary", center: true, key: "Escape" });
    });
    setMode("rru");
  }
}


// estação e modo deste módulo (game/registry.js)
registerStation("ladder", { label: (k) => `Subir na torre do ${siteById(k.split(":")[1]).name}` + (player.epi ? "" : " (precisa de EPI)"), open: startClimb });
registerMode("climb", {
  prompt: () => {
    const top = player.climbY >= world.tower.climbMax - 0.02, bottom = player.climbY < 0.05;
    return { key: "climb:" + top + bottom, html: (bottom ? `<button id="pAct"><kbd>E</kbd>Sair da escada</button>` : top ? `<button id="pAct"><kbd>E</kbd>Inspecionar RRUs</button>` : "") + `<button class="sec" disabled>W / S · subir e descer</button>` };
  },
  primary: () => climbAction()
});
registerMode("rru", { escape: () => setMode("climb") });

export { climbAction };
