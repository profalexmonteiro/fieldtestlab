// Registro de estações e modos: cada módulo declara o que oferece, sem que a interface precise conhecê-lo.
//
// registerStation(prefixo, { label(key), open(key) })
//   prefixo da chave em `stations` (ex.: "tv", "rack" para "rack:delta"); label = texto do botão E; open = ação.
//
// registerMode(modo, { objective?(), prompt?() → { key, html } | null, primary?(), escape?(), hover?(item), pick?(item) })
//   objective: texto do objetivo enquanto nesse modo · prompt/primary: dica e ação da tecla E · escape: tecla Esc
//   hover/pick: itens 3D apontados/clicados (armário)
export const stationTypes = {};
export const modeTypes = {};

export function registerStation(prefix, def) { stationTypes[prefix] = def; }
export function registerMode(name, def) { modeTypes[name] = { ...(modeTypes[name] || {}), ...def }; }
export const stationOf = (key) => stationTypes[key.split(":")[0]];
