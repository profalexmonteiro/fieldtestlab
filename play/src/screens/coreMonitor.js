import { UI, paint, setScreen } from "../ui/screens.js";
import { world } from "../world/world.js";
import { siteById, siteCfg } from "../net/network.js";
import { CORE } from "../world/coreRacks.js";
import { CORES } from "../data/index.js";
import { setMode } from "../game/modes.js";
import { registerStation } from "../game/registry.js";
import { mode } from "../game/state.js";

// Monitor do rack de núcleo: estado dos nós, enlace com a estação e simulação da sinalização (fluxos em data/cores.json)
const FLOWS = CORES.flows;
function openIms(k) {
  const site = siteById(k.split(":")[1]), scr = site.imsScreen, spec = CORE[site.kind], flow = FLOWS[spec.flow], short = spec.title.replace("Rack ", "");
  world.rack = site.ims; world.rackScreen = scr;
  world.rackText = `Monitor do ${short}: confira os nós, o enlace com a ${spec.node} e use “${spec.simBtn.slice(2)}”.`;
  let page = "status", shown = 0, timer = null;
  const stop = () => { clearTimeout(timer); timer = null; };
  const step = () => {
    if (mode !== "rack" || world.rackScreen !== scr || page !== "sip") return stop();
    shown++; paint(scr); if (shown < flow.length) timer = setTimeout(step, 650); else timer = null;
  };
  setScreen(scr, (s) => {
    const kk = s.k, W = s.W, cfg = siteCfg(site);
    UI.bg(s, "#0f1e33"); UI.header(s, `${short} · ${site.name}`, page === "status" ? spec.sub : spec.simSub, spec.head);
    if (page === "status") {
      UI.card(s, 20 * kk, 74 * kk, W - 40 * kk, 58 * kk, "#172A45", "#4fd194");
      UI.text(s, `✓ Enlace com a ${spec.node} do ${site.name} no ar · ${spec.link}`, 36 * kk, 88 * kk, { size: 22, weight: "bold", color: "#4fd194", maxW: W - 70 * kk, maxLines: 1 });
      spec.units.forEach(([n, , role], i) => {
        const cw = (W - 54 * kk) / 2, cx = 20 * kk + (i % 2) * (cw + 14 * kk), cy = 144 * kk + Math.floor(i / 2) * 50 * kk;
        UI.card(s, cx, cy, cw, 42 * kk, "#172A45", "#2f4a72");
        UI.text(s, `● ${n}`, cx + 12 * kk, cy + 8 * kk, { size: 20, weight: "bold", color: "#7ff0b0" });
        UI.text(s, role, cx + 190 * kk, cy + 10 * kk, { size: 18, color: "#c4cfdf", maxW: cw - 200 * kk, maxLines: 1 });
      });
      const ops = [...new Set(cfg.map((r) => r[0]))];
      const reg = ops.map((op) => { const n = cfg.filter((r) => r[0] === op).length; return `${op}: ${3 + n * 4 + (op.length % 3)} UEs (${cfg.filter((r) => r[0] === op).map((r) => r[1]).join("/")})`; }).join("   ·   ");
      UI.text(s, spec.regLabel + ": " + reg, 24 * kk, 352 * kk, { size: 20, weight: "bold", color: "#FFC59A", maxW: W - 48 * kk, maxLines: 2 });
      UI.text(s, spec.path, 24 * kk, 412 * kk, { size: 19, color: "#9fb0c8", maxW: W - 48 * kk, maxLines: 3 });
      UI.btn(s, 24 * kk, s.H - 92 * kk, 400 * kk, 68 * kk, spec.simBtn, () => { page = "sip"; shown = 0; stop(); paint(s); timer = setTimeout(step, 400); }, { kind: "primary", center: true, size: 21, key: "Digit1" });
    } else {
      const rh = Math.min(40, 446 / flow.length) * kk;
      flow.slice(0, shown).forEach(([who, what], i) => {
        const y = 72 * kk + i * rh, ok = /200 OK/.test(what), warn = /401|fraco/.test(what);
        UI.text(s, who, 30 * kk, y, { size: 19, weight: "bold", color: "#FFC59A" });
        UI.text(s, what, 270 * kk, y, { size: 19, color: ok ? "#4fd194" : warn ? "#ffcf6b" : "#E1E6EE", maxW: W - 300 * kk, maxLines: 1 });
      });
      if (shown < flow.length) UI.text(s, "…", 30 * kk, 72 * kk + shown * rh, { size: 22, color: "#9fb0c8" });
      UI.btn(s, 24 * kk, s.H - 92 * kk, 280 * kk, 68 * kk, "◀ Estado do núcleo", () => { page = "status"; stop(); paint(s); }, { kind: "dark", center: true, size: 21 });
    }
    UI.btn(s, W - 224 * kk, s.H - 92 * kk, 200 * kk, 68 * kk, "Voltar ✕", () => { stop(); setMode("free"); }, { kind: "primary", center: true, key: "Escape", size: 22 });
  });
  setMode("rack");
}

// estação e modo deste módulo (game/registry.js)
registerStation("ims", { label: (k) => { const s = siteById(k.split(":")[1]); return `Monitorar o ${CORE[s.kind].title.replace("Rack ", "")} do ${s.name}`; }, open: openIms });
