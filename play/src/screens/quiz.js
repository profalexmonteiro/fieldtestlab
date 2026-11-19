import { shuffle } from "../core/base.js";
import { UI, paint, setScreen } from "../ui/screens.js";

// ======================================================================
// Pergunta de múltipla escolha desenhada numa tela (notebook ou desktop)
// ======================================================================
function quizScreen(scr, q, head, onScore, anim) {
  return new Promise((resolve) => {
    const letters = "ABCD";
    const st = { tries: 0, done: false, busy: false, explain: "", good: false,
      opts: shuffle(q.options.map((text, i) => ({ text, i }))).map((o, j) => ({ ...o, letter: letters[j], state: "" })) };
    const choose = async (j) => {
      const o = st.opts[j]; if (!o || st.done || st.busy || o.state === "bad") return;
      st.busy = true; o.state = "sel"; paint(scr);
      await anim(); st.busy = false; st.tries++;
      const right = o.i === 0;
      if (head.deferFeedback) {
        st.done = true;
        onScore(right ? 1 : 0, right, o.text);
        paint(scr);
        return;
      }
      if (right || st.tries >= 2) {
        st.done = true;
        const frac = right ? (st.tries === 1 ? 1 : 0.4) : 0;
        o.state = right ? "ok" : "bad"; st.opts.find((x) => x.i === 0).state = "ok";
        st.explain = (right ? (st.tries === 1 ? "Correto! " : "Correto na 2ª tentativa. ") : "Não foi dessa vez. ") + q.explain; st.good = right;
        onScore(frac, right);
      } else { o.state = "bad"; st.explain = "Errado. Tente mais uma vez (a 2ª tentativa vale 40%)."; st.good = false; }
      paint(scr);
    };
    setScreen(scr, (s) => {
      const k = s.k, W = s.W, big = s.W > 1100;
      UI.bg(s); UI.header(s, head.title, head.right);
      let y = UI.text(s, q.q, 24 * k, 74 * k, { size: 29, weight: "bold", maxW: W - 48 * k, maxLines: 2 }) + 8 * k;
      const size = big ? 21 : 24;
      st.opts.forEach((o, j) => {
        const lines = Math.min(2, UI.lineHeightFor(s, o.text, size, W - 48 * k - 70 * k)), h = (22 + lines * size * 1.25) * k;
        UI.btn(s, 24 * k, y, W - 48 * k, h, o.text, () => choose(j), { letter: o.letter, kind: o.state || "opt", key: "Key" + o.letter, size, maxLines: 2, disabled: st.done || o.state === "bad" });
        y += h + 9 * k;
      });
      if (st.explain) UI.text(s, st.explain, 24 * k, y + 2 * k, { size: 21, weight: "bold", color: st.done ? (st.good ? "#15724a" : "#c63b3b") : "#9a6100", maxW: st.done ? W - 330 * k : W - 48 * k, maxLines: 3 });
      if (st.done) UI.btn(s, W - 284 * k, s.H - 84 * k, 260 * k, 66 * k, "Continuar →", resolve, { kind: "primary", center: true });
      else UI.text(s, "Clique numa opção ou tecle A–D", W - 24 * k, s.H - 44 * k, { size: 19, color: "#5F6E85", align: "right" });
    });
  });
}

export { quizScreen };
