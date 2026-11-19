// ======================================================================
// Animações (tweens)
// ======================================================================
const tweens = [];
const ease = (k) => (k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2);
const tween = (dur, update) => new Promise((res) => tweens.push({ t: 0, dur, update, res }));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

export { ease, tween, tweens, wait };
