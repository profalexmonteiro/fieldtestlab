// Barramento de eventos: módulos avisam o que aconteceu sem chamar uns aos outros diretamente.
// Eventos do jogo:
//   phase:changed   { from, to }        etapa do chamado mudou (game/state.js)
//   mode:changed    { from, to }        modo do jogador mudou (game/state.js)
//   benchView:changed  view             bancada ↔ notebook
//   cells:changed   { site }            configuração de RRUs aplicada num rack
//   run:accepted    { ch }              chamado aceito na conversa com a Lia
//   run:finished    { ch, total, coins } chamado concluído no desktop
//   player:rebuilt  spec                avatar do engenheiro recriado (troca de uniforme)
//   resize                               janela redimensionada
const handlers = new Map();

export function on(evt, fn) {
  if (!handlers.has(evt)) handlers.set(evt, []);
  handlers.get(evt).push(fn);
  return () => off(evt, fn);
}
export function off(evt, fn) {
  const list = handlers.get(evt); if (!list) return;
  const i = list.indexOf(fn); if (i >= 0) list.splice(i, 1);
}
/** Chama os ouvintes na ordem em que se inscreveram (síncrono). */
export function emit(evt, payload) {
  const list = handlers.get(evt); if (!list) return;
  list.slice().forEach((fn) => fn(payload));
}
/** Remove todos os ouvintes (usado nos testes). */
export function clearEvents() { handlers.clear(); }
