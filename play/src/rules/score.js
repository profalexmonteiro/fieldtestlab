// Pontuação, níveis e recompensas (funções puras).

export const LEVELS = [
  { xp: 0, title: "Estagiário de Campo" }, { xp: 300, title: "Técnico de Testes" },
  { xp: 800, title: "Engenheiro Júnior" }, { xp: 1500, title: "Engenheiro Pleno" },
  { xp: 2500, title: "Engenheiro Sênior" }, { xp: 4000, title: "Especialista em Field Test" }
];
export const PTS = { choice: 20, equipment: 40, verdict: 20, evidence: 20, report: 25, attach: 50 };

export function levelOf(xp) { let i = 0; LEVELS.forEach((l, k) => { if (xp >= l.xp) i = k; }); return i; }

/** Pontuação máxima de um chamado (ch.game = conteúdo do desafio). */
export function maxScore(ch) {
  const g = ch.game, fails = ch.scenarios.filter((s) => s.statusClass === "bad").length;
  return PTS.equipment + g.setup.length * PTS.choice + ch.scenarios.length * PTS.verdict + fails * PTS.evidence + g.report.length * PTS.report + PTS.attach;
}

/** Conferência do armário: −10 por item obrigatório faltando, −8 por item desnecessário (neutros não contam). */
export function equipmentScore(required, neutral, selected) {
  const sel = new Set(selected);
  const missing = required.filter((k) => !sel.has(k));
  const extra = [...sel].filter((k) => !required.includes(k) && !neutral.includes(k));
  return { pts: Math.max(0, PTS.equipment - missing.length * 10 - extra.length * 8), missing, extra };
}

/** Evidência escolhida na análise: métrica ruim vale tudo, de atenção vale metade. */
export const evidencePoints = (tone) => (tone === "bad-text" ? PTS.evidence : tone === "warn-text" ? PTS.evidence / 2 : 0);

/** Anexos do relatório: acertos menos erros, proporcional ao que deveria ser anexado. */
export const attachPoints = (hit, wrong, expected) => Math.max(0, Math.round(PTS.attach * (hit - wrong) / Math.max(1, expected)));

/** Recompensa ao concluir: estrelas, moedas e o novo registro de progresso do desafio.
 *  1ª conclusão paga o total; repetições pagam a melhora sobre o recorde + 35% do total. */
export function runReward(total, max, prev) {
  const p = prev || { best: 0, runs: 0, completed: false, stars: 0 };
  const pct = total / max, stars = pct >= 0.85 ? 3 : pct >= 0.6 ? 2 : 1;
  const coins = !p.completed ? total : Math.max(0, total - p.best) + Math.round(total * 0.35);
  return { stars, coins, progress: { completed: true, best: Math.max(p.best, total), runs: p.runs + 1, stars: Math.max(p.stars || 0, stars) } };
}

/** Desafios liberados: o primeiro sempre; os demais quando o anterior foi concluído. */
export function unlocked(challenges, progress) {
  return challenges.filter((c, i) => i === 0 || ((progress || {})[challenges[i - 1].id] || {}).completed);
}
