import { G } from "../core/store.js";
import { PTS, isRef, toast } from "../core/base.js";
import { TONE, UI, paint, setScreen } from "../ui/screens.js";
import { addScore, typeAnim } from "./modes.js";
import { refreshObjective } from "../ui/objective.js";
import { evidencePoints } from "../rules/score.js";

// Análise de cada telefone na tela do notebook
function analysis(s, nb) {
  return new Promise((resolve) => {
    const truth = s.statusClass === "bad" ? "fail" : "pass";
    const st = { step: "verdict", verdict: null, picked: -1 };
    const last = G.run.bench.idx + 1 >= G.run.ch.scenarios.length;
    const metricBox = (sc, i, bx, by, bw, bh, clickable) => {
      const m = s.metrics[i], reveal = st.step === "result" || (st.step === "evidence" && false);
      if (clickable) UI.btn(sc, bx, by, bw, bh, `${m.label}: ${m.value} · ${m.note || ""}`, () => pick(i), { kind: "opt", key: "Digit" + (i + 1), size: 21, maxLines: 3 });
      else {
        const [f, stroke] = TONE[m.tone || ""] || TONE[""];
        UI.card(sc, bx, by, bw, bh, reveal ? f : "#FFFFFF", st.picked === i ? "#FF6B00" : reveal ? stroke : "#C9D1DD");
        UI.text(sc, m.label, bx + 14 * sc.k, by + 6 * sc.k, { size: 18, color: "#46566E", maxW: bw - 24 * sc.k, maxLines: 1 });
        UI.text(sc, m.value, bx + 14 * sc.k, by + 30 * sc.k, { size: 24, weight: "bold", maxW: bw - 24 * sc.k, maxLines: 1 });
        UI.text(sc, m.note || "", bx + 14 * sc.k, by + 62 * sc.k, { size: 17, color: "#46566E", maxW: bw - 24 * sc.k, maxLines: 1 });
      }
    };
    const choose = async (v) => {
      if (st.step !== "verdict") return;
      await typeAnim(380);
      st.verdict = v; const correct = v === truth;
      addScore("tests", correct ? PTS.verdict : 0);
      G.run.tests[s.id] = { verdict: v, correct }; refreshObjective();
      st.step = truth === "fail" ? "evidence" : "result"; paint(nb.scr);
    };
    const pick = async (i) => {
      if (st.step !== "evidence") return;
      await typeAnim(300);
      const pts = evidencePoints(s.metrics[i].tone);
      addScore("tests", pts); if (!pts) toast("Essa métrica não mostra o defeito", "bad");
      st.picked = i; st.step = "result"; paint(nb.scr);
    };
    setScreen(nb.scr, (sc) => {
      const k = sc.k, W = sc.W, x = sc.x;
      UI.bg(sc); UI.header(sc, "Análise · " + s.label, isRef(s) ? "CDUT · referência" : "DUT · sob teste");
      if (st.step === "verdict") {
        UI.card(sc, 20 * k, 76 * k, W - 40 * k, 330 * k, "#0A192F");
        x.font = "21px Consolas, monospace"; x.textAlign = "left";
        nb.lines.slice(-9).forEach((l, i) => { x.fillStyle = l.c || "#C9D6E8"; x.fillText(l.t.slice(0, 84), 34 * k, (110 + i * 33) * k); });
        UI.text(sc, "Qual é o veredito deste teste?", 24 * k, 420 * k, { size: 28, weight: "bold" });
        UI.btn(sc, 24 * k, 476 * k, (W - 62 * k) / 2, 96 * k, "✅ Aprovado (sem falha)", () => choose("pass"), { letter: "A", key: "KeyA", size: 26 });
        UI.btn(sc, 38 * k + (W - 62 * k) / 2, 476 * k, (W - 62 * k) / 2, 96 * k, "❌ Falha reproduzida", () => choose("fail"), { letter: "B", key: "KeyB", size: 26 });
        return;
      }
      const t = G.run.tests[s.id];
      UI.card(sc, 20 * k, 74 * k, W - 40 * k, 46 * k, t.correct ? "#E8F6EF" : "#FDEEEE", t.correct ? "#15724a" : "#c63b3b");
      UI.text(sc, `Seu veredito: ${t.verdict === "pass" ? "Aprovado" : "Falha"} ${t.correct ? "✔ correto" : "✗ o caso é " + (truth === "pass" ? "aprovado" : "falha")}`, 34 * k, 80 * k, { size: 22, weight: "bold" });
      const n = s.metrics.length, cols = 2, bw = (W - 54 * k) / cols, bh = (st.step === "evidence" ? 92 : 90) * k;
      let y0 = 132 * k;
      if (st.step === "evidence") { UI.text(sc, "Clique na métrica que melhor comprova a falha (ou teclas 1–" + n + "):", 24 * k, y0 - 4 * k, { size: 22, weight: "bold", color: "#B54800" }); y0 += 36 * k; }
      for (let i = 0; i < n; i++) metricBox(sc, i, 20 * k + (i % cols) * (bw + 14 * k), y0 + Math.floor(i / cols) * (bh + 10 * k), bw, bh, st.step === "evidence");
      if (st.step === "result") {
        const yR = y0 + Math.ceil(n / cols) * (bh + 10 * k) + 4 * k;
        let yy = UI.text(sc, `Resultado do caso: ${s.status}. ${s.title}.`, 24 * k, yR, { size: 22, weight: "bold", color: truth === "fail" ? "#c63b3b" : "#15724a", maxW: W - 48 * k, maxLines: 2 });
        if (s.notice) UI.text(sc, "Nota do field tester: " + s.notice, 24 * k, yy + 2 * k, { size: 17, color: "#46566E", maxW: W - 330 * k, maxLines: 3 });
        UI.btn(sc, W - 290 * k, sc.H - 80 * k, 266 * k, 62 * k, last ? "Concluir testes →" : "Próximo telefone →", resolve, { kind: "primary", center: true, size: 23 });
      }
    });
  });
}


export { analysis };
