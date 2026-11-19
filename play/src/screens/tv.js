import { G } from "../core/store.js";
import { CHALLENGES, isRef, pad2, save, unlockedChallenges } from "../core/base.js";
import { FONT, UI, setScreen } from "../ui/screens.js";
import { world } from "../world/world.js";
import { REQUIRED_CELLS, cellName, cellOn, missingCells } from "../net/network.js";
import { npc } from "../world/characters.js";
import { setMode } from "../game/modes.js";
import { registerMode, registerStation } from "../game/registry.js";
import { on } from "../core/events.js";

// ======================================================================
// TV de chamados
// ======================================================================
G.offerIdx = 0;
function tvRender(withBack) {
  setScreen(world.tv, (s) => {
    const k = s.k, x = s.x, W = s.W;
    UI.bg(s, "#0f2a4d");
    const ch = G.run ? G.run.ch : (npc.offering ? npc.offering : null);
    x.fillStyle = "#FF6B00"; x.fillRect(0, 0, W, 70 * k);
    x.fillStyle = "#0A192F"; x.font = `bold ${36 * k}px ${FONT}`; x.textAlign = "left"; x.fillText("CHAMADOS DE FIELD TEST · NovaLink · Site Delta", 26 * k, 48 * k);
    if (!ch) {
      const done = CHALLENGES.filter((c) => (save.progress[c.id] || {}).completed).length;
      UI.text(s, `Chamados resolvidos: ${done}/${CHALLENGES.length}`, 30 * k, 110 * k, { size: 40, weight: "bold", color: "#4fd194" });
      const rowHeight = Math.min(62, 280 / Math.max(1, CHALLENGES.length - 1));
      CHALLENGES.forEach((c, i) => {
        const p = save.progress[c.id] || {}, un = unlockedChallenges().includes(c);
        UI.text(s, `${un ? (p.completed ? "✔" : "•") : "🔒"}  Desafio ${pad2(c.num)} · ${c.game.short}${p.completed ? `  ·  recorde ${p.best}` : ""}`, 30 * k, (190 + i * rowHeight) * k, { size: 32, color: un ? "#F4F6F9" : "#7f8ea6" });
      });
      UI.text(s, "Fale com a supervisora Lia para receber o próximo chamado.", 30 * k, 520 * k, { size: 28, color: "#FFC59A" });
    } else {
      const status = G.run ? "EM ANDAMENTO · " + save.name : "NOVO CHAMADO";
      UI.text(s, `${status}  ·  Desafio ${pad2(ch.num)}`, 30 * k, 86 * k, { size: 26, weight: "bold", color: "#FFC59A" });
      let y = UI.text(s, ch.title, 30 * k, 122 * k, { size: 40, weight: "bold", color: "#FFFFFF", maxW: W - 60 * k, maxLines: 1 });
      y = UI.text(s, ch.description, 30 * k, y + 6 * k, { size: 26, color: "#C9D6E8", maxW: W - 60 * k, maxLines: 2 });
      const bw = (W - 60 * k - 2 * 16 * k) / 3;
      ch.sideInfo.forEach((si, i) => {
        const bx = 30 * k + i * (bw + 16 * k);
        UI.card(s, bx, y + 14 * k, bw, 92 * k, "#172A45", "#2f4a72");
        UI.text(s, si.label.toUpperCase(), bx + 16 * k, y + 22 * k, { size: 20, color: "#9fb0c8" });
        UI.text(s, si.value, bx + 16 * k, y + 54 * k, { size: 26, weight: "bold", color: "#FFFFFF", maxW: bw - 30 * k, maxLines: 1 });
      });
      y += 124 * k;
      UI.text(s, "Aparelhos a testar", 30 * k, y, { size: 26, weight: "bold", color: "#FFFFFF" });
      ch.scenarios.forEach((sc, i) => {
        const col = i % 2, row = Math.floor(i / 2), xx = 30 * k + col * (W / 2), yy = y + 40 * k + row * 44 * k;
        UI.card(s, xx, yy + 4 * k, 82 * k, 34 * k, isRef(sc) ? "#15724a" : "#B54800");
        UI.text(s, isRef(sc) ? "CDUT" : "DUT", xx + 41 * k, yy + 2 * k, { size: 20, weight: "bold", color: "#FFFFFF", align: "center" });
        UI.text(s, sc.label, xx + 96 * k, yy, { size: 24, color: "#F4F6F9", maxW: W / 2 - 130 * k, maxLines: 1 });
      });
    }
    if (ch) {
      const req = REQUIRED_CELLS[ch.id] || [], miss = missingCells(ch);
      UI.card(s, 0, s.H - 56 * k, W, 56 * k, miss.length ? "#3a1a1f" : "#0f2c22");
      UI.text(s, "Rede necessária: " + req.map((c) => (cellOn(c[0], c[1]) ? "✓ " : "✗ ") + cellName(c)).join("   ") + (miss.length ? "   → configure nos racks dos sites" : "   → tudo no ar"), 30 * k, s.H - 50 * k, { size: 24, weight: "bold", color: miss.length ? "#ff9a9a" : "#4fd194", maxW: W - 60 * k, maxLines: 1 });
    }
    if (withBack) UI.btn(s, W - 226 * k, 8 * k, 210 * k, 54 * k, "Voltar ✕", () => setMode("free"), { kind: "dark", center: true, key: "Escape" });
  });
}
const H = (s) => s.H;
function openTV() { tvRender(true); setMode("tv"); }


// a TV mostra quais células do chamado estão no ar: atualiza quando um rack é reconfigurado
on("cells:changed", () => { if (G.run) tvRender(false); });
// estação e modo deste módulo (game/registry.js)
registerStation("tv", { label: () => "Ler o chamado na TV", open: openTV });
registerMode("tv", { escape: () => setMode("free") });

export { tvRender };
