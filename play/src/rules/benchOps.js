// Passos de bancada de um cenário a partir de data/benchOps.json (função pura).
// Cada passo pode ter: when (regex que o rótulo do cenário deve conter), unless (regex que não pode conter),
// match (regex obrigatória; os grupos preenchem {1}, {2}… nos textos) e use (nome de um template).

const fill = (text, m) => text.replace(/\{(\d)\}/g, (_, i) => (m ? m[+i] : ""));

/** Lista de passos { label, title, lines, fx } para o cenário com esse rótulo. */
export function opsForScenario(defs, challengeId, scenarioLabel) {
  const out = [];
  for (const raw of (defs.challenges[challengeId] || [])) {
    const d = raw.use ? { ...defs.templates[raw.use], ...raw } : raw;
    if (d.when && !new RegExp(d.when).test(scenarioLabel)) continue;
    if (d.unless && new RegExp(d.unless).test(scenarioLabel)) continue;
    let m = null;
    if (d.match) { m = scenarioLabel.match(new RegExp(d.match)); if (!m) continue; }
    out.push({ label: fill(d.label, m), title: fill(d.title, m), lines: d.lines.map((l) => fill(l, m)), fx: d.fx });
  }
  return out;
}
