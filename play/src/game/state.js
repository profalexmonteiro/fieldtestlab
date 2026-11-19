// Estado de alto nível do jogo, em duas máquinas de estados:
//  - phase: etapa do chamado      enter → board → cabinet → bench → return → report → board …
//  - mode:  o que o jogador está fazendo agora (andando, numa tela, na bancada, dirigindo…)
// Quem precisa reagir a mudanças escuta "phase:changed" / "mode:changed" (core/events.js).
import { createMachine } from "../core/fsm.js";

export const PHASES = {
  enter: ["board"],        // caminhando até o laboratório
  board: ["cabinet"],      // sem chamado: falar com a Lia
  cabinet: ["bench"],      // chamado aceito: pegar materiais no armário
  bench: ["return"],       // testes na bancada
  return: ["report"],      // recolher os materiais da bancada e devolver ao armário
  report: ["board"]        // relatório no desktop
};
export const MODES = ["free", "climb", "npc", "tv", "cabinet", "bench", "desk", "shop", "rack", "rru", "drive"];

export let phase = "enter";
export let mode = "free";

const phaseMachine = createMachine("phase", "enter", PHASES, { onChange: (s) => { phase = s; }, strict: !import.meta.env.PROD });
const modeMachine = createMachine("mode", "free", Object.fromEntries(MODES.map((m) => [m, "*"])), { onChange: (s) => { mode = s; } });

export const setPhase = (p) => phaseMachine.go(p);
export const goMode = (m) => modeMachine.go(m);
export { phaseMachine, modeMachine };
