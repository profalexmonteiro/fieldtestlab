import { UI, paint, setScreen } from "../ui/screens.js";
import {
  CAMPAIGN_PTS, DELTA_FIELDS, DELTA_TOLERANCE, campaignStats, cellsText, expectedDiscards, gradeDeltas, gradeDiscards
} from "../rules/campaign.js";

// ======================================================================
// Planilha interativa da campanha de KPI (desktop do relatório)
//  1) o aluno marca as iterações que saem do cálculo e recebe a correção linha a linha;
//  2) com as médias e os σ das válidas, digita os deltas e escolhe PASS/FAIL por sentido.
// Os números são digitados num <input> invisível (como o crachá); com ele em foco,
// os atalhos de teclado das telas ficam desligados (core/input.js → typing()).
// ======================================================================
const dec = (value, digits = 1) => (Number.isFinite(value) ? value.toFixed(digits).replace(".", ",").replace("-", "−") : "—");
const signed = (value, digits = 1) => (value > 0 ? "+" : "") + dec(value, digits);
const MONO = "Consolas, monospace";

let numInput = null;
function input() {
  if (!numInput) {
    numInput = document.createElement("input");
    numInput.className = "ghost-input";
    numInput.setAttribute("inputmode", "decimal");
    numInput.setAttribute("autocomplete", "off");
    numInput.setAttribute("aria-label", "Valor da planilha");
    document.body.appendChild(numInput);
  }
  return numInput;
}

function campaignScreen(scr, campaign, head) {
  return new Promise((resolve) => {
    const field = input();
    const marked = new Set();
    const answers = {};
    let step = "mark";          // mark → marked → deltas → done
    let discards = null;
    let stats = null;
    let grade = null;
    let active = null;           // chave do campo em edição

    const repaint = () => paint(scr);
    const edit = (key) => { active = key; field.value = answers[key] || ""; field.focus(); repaint(); };
    const nextField = () => {
      const keys = DELTA_FIELDS.map(([dir, key]) => dir + "." + key);
      const i = keys.indexOf(active);
      if (i >= 0 && i < keys.length - 1) edit(keys[i + 1]);
      else { active = null; field.blur(); repaint(); }
    };
    const onInput = () => { if (active) { answers[active] = field.value.slice(0, 10); repaint(); } };
    const onKey = (e) => {
      if (e.key === "Enter" || e.key === "Tab") { e.preventDefault(); nextField(); }
      if (e.key === "Escape") { e.preventDefault(); active = null; field.blur(); repaint(); }
    };
    field.addEventListener("input", onInput);
    field.addEventListener("keydown", onKey);
    const finish = (result) => {
      field.removeEventListener("input", onInput);
      field.removeEventListener("keydown", onKey);
      field.blur();
      resolve(result);
    };

    // Uma linha da planilha: botão (clicável no passo 1) com o texto em fonte monoespaçada por cima.
    const row = (sc, it, y, h) => {
      const { k, W, x } = sc;
      const review = discards?.rows.find((r) => r.it === it.it);
      const isMarked = marked.has(it.it);
      const kind = review ? (review.correct ? (review.expected ? "ok" : "dim") : "bad") : isMarked ? "sel" : "ghost";
      UI.btn(sc, 24 * k, y, W - 48 * k, h, "", () => {
        if (step !== "mark") return;
        if (marked.has(it.it)) marked.delete(it.it); else marked.add(it.it);
        repaint();
      }, { kind, disabled: step !== "mark" });
      const base = String(it.it).padStart(2, "0") + (review ? (review.marked ? " X " : "   ") : isMarked ? " X " : "   ")
        + "│ DL " + dec(it.dl[0]).padStart(6) + " / " + dec(it.dl[1]).padStart(6)
        + " │ UL " + dec(it.ul[0]).padStart(4) + " / " + dec(it.ul[1]).padStart(4)
        + " │ PCI " + (cellsText(it.cells[0]) + " / " + cellsText(it.cells[1])).padEnd(21) + " │ ";
      const tail = review
        ? (review.expected ? (review.correct ? "✓ sai: " : "✗ devia sair: ") + review.reasons.join("; ")
          : review.correct ? "✓ válida" : "✗ válida, devia ficar")
        : "RSRP " + dec(it.rsrp[0]) + " / " + dec(it.rsrp[1]) + " │ SINR " + dec(it.sinr[0]) + " / " + dec(it.sinr[1]);
      x.font = `${15 * k}px ${MONO}`; x.textAlign = "left"; x.textBaseline = "middle";
      x.fillStyle = review && !review.correct ? "#9b1c1c" : "#0A192F";
      x.fillText(base + tail, 36 * k, y + h / 2, W - 72 * k);
      x.textBaseline = "alphabetic";
    };

    const drawSheet = (sc) => {
      const { k, W } = sc;
      UI.header(sc, "Planilha da campanha · descartes", head);
      const intro = step === "mark"
        ? "Clique nas iterações que devem SAIR do cálculo. Mbps de aplicação (DUT / CDUT); PCI, RSRP (dBm) e SINR (dB) de cada aparelho."
        : `Descartes: ${discards.correct}/15 linhas corretas · ${discards.points}/${CAMPAIGN_PTS.discards} pontos. Válida: os dois 100% na PCI ${campaign.criteria.pci}, Near-Cell e Δ RF ≤ ${campaign.criteria.rfDelta} dB.`;
      UI.text(sc, intro, 24 * k, 68 * k, { size: 17, maxW: W - 48 * k, maxLines: 2, color: "#46566E" });
      const h = 24 * k;
      campaign.iterations.forEach((it, i) => row(sc, it, (122 + i * 26) * k, h));
      const by = sc.H - 66 * k;
      if (step === "mark") {
        UI.text(sc, marked.size + " marcada(s) para descarte", 24 * k, by + 8 * k, { size: 19, weight: "bold" });
        UI.btn(sc, W - 330 * k, by, 306 * k, 52 * k, "Conferir descartes →", () => {
          discards = gradeDiscards(campaign, marked);
          stats = campaignStats(campaign, new Set(expectedDiscards(campaign)));
          step = "marked"; repaint();
        }, { kind: "primary", center: true, size: 21 });
      } else {
        UI.text(sc, "Os deltas usam as iterações válidas pelo procedimento.", 24 * k, by + 8 * k, { size: 18, color: "#46566E" });
        UI.btn(sc, W - 330 * k, by, 306 * k, 52 * k, "Calcular os deltas →", () => { step = "deltas"; repaint(); },
          { kind: "primary", center: true, size: 21 });
      }
    };

    const drawDeltas = (sc) => {
      const { k, W, x } = sc;
      const reviewing = step === "done";
      UI.header(sc, "Planilha da campanha · deltas e veredito", head);
      UI.text(sc, `Δ = (DUT − CDUT) ÷ CDUT × 100, em %. PASS no sentido se |Δ média| < ${campaign.criteria.meanPct}% e |Δσ| < ${campaign.criteria.sigmaPct}%. σ amostral (n − 1) sobre as ${stats.n} iterações válidas.`,
        24 * k, 68 * k, { size: 17, maxW: W - 48 * k, maxLines: 2, color: "#46566E" });
      // valores dados pela planilha
      const colX = [24, 150, 300, 450, 600].map((v) => v * k);
      const headY = 128 * k;
      x.font = `bold ${15 * k}px Inter, Arial, sans-serif`; x.fillStyle = "#46566E"; x.textAlign = "left";
      ["", "média DUT", "média CDUT", "σ DUT", "σ CDUT"].forEach((t, i) => x.fillText(t, colX[i], headY));
      ["dl", "ul"].forEach((dir, r) => {
        const y = (156 + r * 34) * k, s = stats[dir];
        x.font = `bold ${18 * k}px Inter, Arial, sans-serif`; x.fillStyle = "#0A192F";
        x.fillText(dir.toUpperCase(), colX[0], y);
        x.font = `${18 * k}px ${MONO}`;
        [s.dut.mean, s.cdut.mean, s.dut.sd, s.cdut.sd].forEach((v, i) => x.fillText(dec(v, 2) + " Mbps", colX[i + 1], y));
      });

      // campos digitáveis
      const fy = 232 * k, fw = (W - 48 * k - 3 * 14 * k) / 4, fh = 82 * k;
      DELTA_FIELDS.forEach(([dir, key, label], i) => {
        const id = dir + "." + key, fx = 24 * k + i * (fw + 14 * k);
        const item = reviewing && grade.deltas[i];
        const kind = item ? (item.correct ? "ok" : "bad") : active === id ? "sel" : "ghost";
        UI.btn(sc, fx, fy, fw, fh, "", () => { if (!reviewing) edit(id); }, { kind, disabled: reviewing });
        UI.text(sc, label + " (%)", fx + 14 * k, fy + 4 * k, { size: 16, color: "#46566E" });
        const typed = (answers[id] || "") + (active === id ? "▏" : "");
        UI.text(sc, typed || "clique e digite", fx + 14 * k, fy + 30 * k, { size: typed ? 26 : 18, weight: typed ? "bold" : "", color: typed ? "#0A192F" : "#9AA6B8", mono: Boolean(typed) });
        if (item) UI.text(sc, (item.correct ? "✓ " : "✗ ") + "correto: " + signed(item.expected) + "%", fx + 14 * k, fy + fh + 4 * k,
          { size: 16, weight: "bold", color: item.correct ? "#15724a" : "#c63b3b" });
      });

      // veredito por sentido
      const vy = 372 * k;
      UI.text(sc, "Veredito de cada sentido", 24 * k, vy - 32 * k, { size: 20, weight: "bold" });
      ["dl", "ul"].forEach((dir, r) => {
        const y = vy + r * 62 * k, chosen = answers[dir + ".verdict"];
        const item = reviewing && grade.verdicts[r];
        UI.text(sc, dir.toUpperCase(), 24 * k, y + 6 * k, { size: 22, weight: "bold" });
        ["pass", "fail"].forEach((value, j) => {
          const isChosen = chosen === value;
          const kind = item ? (value === item.expected ? "ok" : isChosen ? "bad" : "dim") : isChosen ? "sel" : "ghost";
          UI.btn(sc, (100 + j * 180) * k, y, 166 * k, 50 * k, value.toUpperCase(), () => {
            if (reviewing) return;
            answers[dir + ".verdict"] = value; active = null; field.blur(); repaint();
          }, { kind, center: true, size: 21, weight: "bold", disabled: reviewing });
        });
        if (item) {
          const s = stats[dir];
          UI.text(sc, `|Δ média| ${dec(Math.abs(s.dMean))}% ${s.passMean ? "<" : "≥"} ${campaign.criteria.meanPct}% · |Δσ| ${dec(Math.abs(s.dSigma))}% ${s.passSigma ? "<" : "≥"} ${campaign.criteria.sigmaPct}%`,
            470 * k, y + 8 * k, { size: 17, color: "#46566E" });
        }
      });

      const by = sc.H - 66 * k;
      if (!reviewing) {
        const ready = DELTA_FIELDS.every(([dir, key]) => answers[dir + "." + key]) && answers["dl.verdict"] && answers["ul.verdict"];
        UI.text(sc, ready ? "Tudo preenchido." : "Preencha os quatro deltas e os dois vereditos.", 24 * k, by + 8 * k, { size: 18, color: "#46566E" });
        UI.btn(sc, W - 330 * k, by, 306 * k, 52 * k, "Conferir cálculo →", () => {
          grade = gradeDeltas(stats, answers); active = null; field.blur(); step = "done"; repaint();
        }, { kind: ready ? "primary" : "dim", center: true, size: 21, disabled: !ready });
      } else {
        UI.text(sc, `Deltas e veredito: ${grade.points}/${CAMPAIGN_PTS.deltas + CAMPAIGN_PTS.verdicts} pontos (tolerância ±${DELTA_TOLERANCE} p.p.).`, 24 * k, by + 8 * k, { size: 18, weight: "bold" });
        UI.btn(sc, W - 330 * k, by, 306 * k, 52 * k, "Seguir para o relatório →", () => finish({
          marked: [...marked].sort((a, b) => a - b),
          discards, stats, answers: { ...answers }, grade,
          points: discards.points + grade.points
        }), { kind: "primary", center: true, size: 21 });
      }
    };

    setScreen(scr, (sc) => {
      UI.bg(sc);
      if (step === "mark" || step === "marked") drawSheet(sc);
      else drawDeltas(sc);
    });
  });
}

export { campaignScreen };
