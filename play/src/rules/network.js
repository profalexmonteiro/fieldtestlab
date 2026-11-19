// Regras da rede de acesso (funções puras: sem Three.js, sem DOM, sem save global).
// `overrides` é o mapa { siteId: [[operadora, banda] × 3] } salvo pelo jogador nos racks.

export const cellName = ([op, band]) => `${op} ${band}`;

/** Configuração atual das RRUs de um site (cópia). */
export function siteConfig(site, overrides) {
  return ((overrides || {})[site.id] || site.def).map((r) => r.slice());
}

/** Há alguma RRU, em qualquer site, transmitindo essa operadora nessa banda?
 *  `draft` = { site, cfg } permite testar uma configuração ainda não aplicada. */
export function cellOn(sites, overrides, op, band, draft) {
  return sites.some((s) => (draft && draft.site.id === s.id ? draft.cfg : siteConfig(s, overrides)).some(([o, b]) => o === op && b === band));
}

/** Células exigidas que estão fora do ar. */
export function missingCells(required, sites, overrides, draft) {
  return (required || []).filter(([o, b]) => !cellOn(sites, overrides, o, b, draft));
}

/** PCI de uma RRU (determinístico por site, setor e banda). */
export function pciOf(sites, overrides, site, i) {
  const idx = sites.findIndex((s) => s.id === site.id);
  return 80 + idx * 40 + i * 8 + (siteConfig(site, overrides)[i][1] === "n41" ? 57 : 0);
}

/** Modelo simplificado de RSRP (dBm) a partir da distância e da perda da banda. */
export function rsrpAt(site, band, x, z, bands) {
  const d = Math.max(5, Math.hypot(site.x - x, site.z - z));
  return Math.round(-40 - 32 * Math.log10(d) - bands[band].loss);
}

/** Melhor célula no ponto (x, z), como num drive test. */
export function bestCell(sites, overrides, bands, x, z) {
  let best = null;
  sites.forEach((s) => siteConfig(s, overrides).forEach(([op, band], i) => {
    const rsrp = rsrpAt(s, band, x, z, bands);
    if (!best || rsrp > best.rsrp) best = { site: s, op, band, rsrp, pci: pciOf(sites, overrides, s, i) };
  }));
  return best;
}

/** Uma configuração de rack é válida para o site? (3 RRUs, operadoras conhecidas, bandas que o site aceita) */
export function validSiteConfig(site, cfg, operators) {
  return Array.isArray(cfg) && cfg.length === site.def.length &&
    cfg.every((r) => Array.isArray(r) && r.length === 2 && operators.includes(r[0]) && site.bands.includes(r[1]));
}
