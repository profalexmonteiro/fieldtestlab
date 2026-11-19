// Máquina de estados mínima: estados nomeados, transições permitidas, ganchos de entrada/saída e evento "<id>:changed".
import { emit } from "./events.js";

/**
 * @param {string} id            nome da máquina (o evento emitido é `${id}:changed`)
 * @param {string} initial       estado inicial
 * @param {Object<string, string[]|"*">} transitions  para cada estado, os destinos permitidos ("*" = qualquer estado conhecido)
 * @param {{ onChange?: Function, strict?: boolean }} [opts]  onChange roda antes do evento (para sincronizar variáveis);
 *        strict=false só avisa no console em vez de lançar erro numa transição inválida
 */
export function createMachine(id, initial, transitions, opts = {}) {
  if (!(initial in transitions)) throw new Error(`[${id}] estado inicial desconhecido: ${initial}`);
  const enterHooks = {}, exitHooks = {};
  const m = {
    id, state: initial,
    /** Pode ir para `to`? Repetir o estado atual é sempre permitido (reentrada). */
    can(to) {
      if (!(to in transitions)) return false;
      if (to === m.state) return true;
      const allowed = transitions[m.state];
      return allowed === "*" || allowed.includes(to);
    },
    go(to, data) {
      if (!m.can(to)) {
        const msg = `[${id}] transição inválida: ${m.state} → ${to}`;
        if (opts.strict === false) console.warn(msg); else throw new Error(msg);
        if (!(to in transitions)) return m;
      }
      const from = m.state;
      (exitHooks[from] || []).forEach((fn) => fn(to, data));
      m.state = to;
      if (opts.onChange) opts.onChange(to, from);
      (enterHooks[to] || []).forEach((fn) => fn(from, data));
      emit(`${id}:changed`, { from, to, data });
      return m;
    },
    onEnter(state, fn) { (enterHooks[state] = enterHooks[state] || []).push(fn); },
    onExit(state, fn) { (exitHooks[state] = exitHooks[state] || []).push(fn); }
  };
  return m;
}
