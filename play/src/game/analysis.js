import { G } from "../core/store.js";
import { isRef } from "../core/base.js";
import { UI, paint, setScreen } from "../ui/screens.js";
import { typeAnim } from "./modes.js";
import { captureLines, campaignPages } from "../rules/capture.js";
import { fieldLine } from "../rules/field.js";

function analysis(scenario, notebook, fieldSamples) {
  return new Promise((resolve) => {
    const scr = notebook.scr;
    const last = G.run.bench.idx + 1 >= G.run.ch.scenarios.length;
    const records = captureLines(scenario);
    const capture = [...records, ...fieldSamples.map((sample) => ({ t: "Campo 3D · " + fieldLine(sample) }))];
    const pages = G.run.ch.campaign ? [capture, ...campaignPages(G.run.ch.campaign)] : [capture];
    let page = 0;
    let step = "verdict";
    let verdict;
    let busy = false;

    const choose = async (value) => {
      if (busy || step !== "verdict") return;
      busy = true;
      await typeAnim(380);
      verdict = value;
      step = "evidence";
      busy = false;
      paint(scr);
    };
    const pick = async (index) => {
      if (busy || step !== "evidence") return;
      busy = true;
      await typeAnim(300);
      G.run.tests[scenario.id] = { verdict, evidence: index, fieldSamples };
      step = "saved";
      busy = false;
      paint(scr);
    };
    const turnPage = (index) => { if (!busy) { page = index; paint(scr); } };

    setScreen(scr, (sc) => {
      const { k, W, H, x } = sc;
      UI.bg(sc);
      UI.header(sc, "Análise · " + scenario.label, isRef(scenario) ? "CDUT · referência" : "DUT · sob teste");
      if (step === "verdict") {
        UI.text(sc, page ? "Planilha da campanha · " + page + "/" + (pages.length - 1) : "Observações da captura", 24 * k, 68 * k,
          { size: 23, weight: "bold" });
        UI.card(sc, 20 * k, 103 * k, W - 40 * k, 296 * k, "#0A192F");
        x.font = "18px Consolas, monospace";
        x.textAlign = "left";
        x.fillStyle = "#C9D6E8";
        pages[page].forEach(({ t }, i) => x.fillText(t, 34 * k, (130 + i * 27) * k, W - 68 * k));
        if (pages.length > 1) {
          if (page > 0) UI.btn(sc, 24 * k, 410 * k, 172 * k, 46 * k, "← Anterior", () => turnPage(page - 1), { key: "ArrowLeft", size: 19 });
          if (page < pages.length - 1) UI.btn(sc, W - 260 * k, 410 * k, 236 * k, 46 * k,
            page ? "Próxima página →" : "Ver planilha →", () => turnPage(page + 1), { key: "ArrowRight", size: 19 });
        }
        UI.text(sc, "Este aparelho mostra o desvio?", 24 * k, 478 * k, { size: 28, weight: "bold" });
        UI.btn(sc, 24 * k, 530 * k, (W - 62 * k) / 2, 96 * k, "Sem desvio", () => choose("pass"), { letter: "A", key: "KeyA", size: 26 });
        UI.btn(sc, 38 * k + (W - 62 * k) / 2, 530 * k, (W - 62 * k) / 2, 96 * k, "Desvio reproduzido", () => choose("fail"), { letter: "B", key: "KeyB", size: 26 });
        return;
      }

      UI.text(sc, "Seu veredito: " + (verdict === "pass" ? "Sem desvio" : "Desvio reproduzido"), 24 * k, 83 * k,
        { size: 26, weight: "bold" });
      if (step === "evidence") {
        UI.text(sc, "Marque a observação que melhor sustenta seu veredito.", 24 * k, 133 * k, { size: 23 });
        const bw = (W - 62 * k) / 2;
        records.forEach(({ t }, i) => UI.btn(sc, 24 * k + (i % 2) * (bw + 14 * k),
          (185 + Math.floor(i / 2) * 110) * k, bw, 96 * k, t, () => pick(i),
          { kind: "opt", key: "Digit" + (i + 1), size: 21, maxLines: 3 }));
        return;
      }

      UI.text(sc, "Veredito e observação registrados. Confira a revisão após entregar o relatório.", 24 * k, 142 * k,
        { size: 23, maxW: W - 48 * k });
      UI.btn(sc, W - 290 * k, H - 80 * k, 266 * k, 62 * k, last ? "Concluir testes →" : "Próximo telefone →", resolve,
        { kind: "primary", center: true, size: 23 });
    });
  });
}

export { analysis };
