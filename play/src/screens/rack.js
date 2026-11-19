import { G } from "../core/store.js";
import { pad2, persist, save, toast } from "../core/base.js";
import { UI, paint, setScreen } from "../ui/screens.js";
import { world } from "../world/world.js";
import { NETWORK } from "../data/index.js";
import { BANDS, OPERATORS, OP_COLORS, REQUIRED_CELLS, cellName, cellOn, missingCells, pciOf, siteById, siteCfg } from "../net/network.js";
import { refreshRruLabels } from "../world/coreRacks.js";
import { setMode } from "../game/modes.js";
import { emit } from "../core/events.js";
import { registerMode, registerStation } from "../game/registry.js";

// ======================================================================
// Monitor do rack e provador (loja)
// ======================================================================
function openRack(k) {
  const site = siteById((k || "rack:delta").split(":")[1]);
  world.rack = site.rack; world.rackScreen = site.screen; world.rackText = null;
  const draft = siteCfg(site); let page = "cfg", saved = true;
  setScreen(site.screen, (s) => {
    const kk = s.k, W = s.W;
    UI.bg(s, "#0f1e33"); UI.header(s, `${site.name} · ${site.kind}`, page === "cfg" ? "Configuração das RRUs" : "Arquitetura", "#172A45");
    if (page === "cfg") {
      draft.forEach(([op, band], i) => {
        const y = 76 * kk + i * 104 * kk;
        UI.card(s, 20 * kk, y, W - 40 * kk, 94 * kk, "#172A45", OP_COLORS[op]);
        UI.text(s, `RRU ${i + 1} · setor ${"αβγ"[i]}`, 36 * kk, y + 6 * kk, { size: 24, weight: "bold", color: "#FFC59A" });
        UI.text(s, `PCI ${pciOf(site, i)} · ${BANDS[band].rat}`, 36 * kk, y + 46 * kk, { size: 20, color: "#9fb0c8" });
        UI.btn(s, 290 * kk, y + 14 * kk, 300 * kk, 66 * kk, "Operadora: " + op, () => { draft[i][0] = OPERATORS[(OPERATORS.indexOf(draft[i][0]) + 1) % OPERATORS.length]; saved = false; paint(s); }, { kind: "dark", center: true, size: 21, key: "Digit" + (i + 1) });
        UI.btn(s, 604 * kk, y + 14 * kk, 316 * kk, 66 * kk, "Banda: " + BANDS[band].name, () => { const bl = site.bands; draft[i][1] = bl[(bl.indexOf(draft[i][1]) + 1) % bl.length]; saved = false; paint(s); }, { kind: "dark", center: true, size: 21, disabled: site.bands.length < 2 });
      });
      const req = G.run ? REQUIRED_CELLS[G.run.ch.id] : null;
      const msg = req ? `Desafio ${pad2(G.run.ch.num)} precisa de: ` + req.map((c) => (cellOn(c[0], c[1], { site, cfg: draft }) ? "✓ " : "✗ ") + cellName(c)).join("   ") : "Sem chamado ativo. Esta estação aceita: " + site.bands.map((b) => BANDS[b].name).join(", ") + ".";
      UI.text(s, msg, 24 * kk, 392 * kk, { size: 21, weight: "bold", color: req && missingCells(G.run.ch, { site, cfg: draft }).length ? "#ff9a9a" : "#4fd194", maxW: W - 48 * kk, maxLines: 3 });
      const by = s.H - 92 * kk;
      UI.btn(s, 24 * kk, by, 280 * kk, 68 * kk, saved ? "✓ Configuração no ar" : "Aplicar configuração", () => {
        save.sites = save.sites || {}; save.sites[site.id] = draft.map((r) => r.slice()); persist(); refreshRruLabels(site); saved = true;
        toast(`${site.name}: ${draft.map((r) => r.join(" ")).join(" · ")}`, "good"); emit("cells:changed", { site }); paint(s);
      }, { kind: saved ? "ok" : "primary", center: true, size: 21, disabled: saved });
      UI.btn(s, 318 * kk, by, 280 * kk, 68 * kk, "Arquitetura do site", () => { page = "info"; paint(s); }, { kind: "dark", center: true, size: 21 });
    } else {
      const items = NETWORK.ranInfo[site.kind];
      items.forEach(([a, b], i) => {
        const bw = (W - 62 * kk) / 2, bx = 24 * kk + (i % 2) * (bw + 14 * kk), byy = 82 * kk + Math.floor(i / 2) * 176 * kk;
        UI.card(s, bx, byy, bw, 162 * kk, "#172A45", "#2f4a72");
        UI.text(s, a, bx + 16 * kk, byy + 10 * kk, { size: 27, weight: "bold", color: "#FFC59A", maxW: bw - 30 * kk, maxLines: 1 });
        UI.text(s, b, bx + 16 * kk, byy + 52 * kk, { size: 24, color: "#E1E6EE", maxW: bw - 30 * kk, maxLines: 3 });
      });
      UI.btn(s, 24 * kk, s.H - 92 * kk, 280 * kk, 68 * kk, "◀ Configurar RRUs", () => { page = "cfg"; paint(s); }, { kind: "dark", center: true, size: 21 });
    }
    UI.btn(s, W - 224 * kk, s.H - 92 * kk, 200 * kk, 68 * kk, "Voltar ✕", () => setMode("free"), { kind: "primary", center: true, key: "Escape", size: 22 });
  });
  setMode("rack");
}

// estação e modo deste módulo (game/registry.js)
registerStation("rack", { label: (k) => `Configurar o rack do ${siteById(k.split(":")[1]).name}`, open: openRack });
registerMode("rack", { escape: () => setMode("free") });
