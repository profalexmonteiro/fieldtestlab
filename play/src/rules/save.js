// Formato do save com versão e migração (funções puras).
// v1: formato original, sem campo "v".
// v2: campo "v"; configurações de rack inválidas são descartadas; tipos e itens obrigatórios garantidos.
import { validSiteConfig } from "./network.js";

export const SAVE_VERSION = 2;
export const SAVE_KEY = "fieldtestgame.v1";       // chave mantida para não perder o progresso de quem já jogou

export const blankSave = () => ({ v: SAVE_VERSION, name: "", coins: 0, xp: 0, owned: ["estagio"], avatar: "estagio", progress: {}, sites: {} });

const num = (v) => (Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0);

/** Converte qualquer save antigo (ou corrompido) para a versão atual.
 *  ctx = { sites, operators, avatars } para validar referências. */
export function migrateSave(raw, ctx) {
  const base = blankSave();
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return base;
  if ((raw.v || 1) > SAVE_VERSION) return { ...base, ...raw };     // save de versão futura: não mexe
  const s = { ...base, ...raw, v: SAVE_VERSION };
  s.name = typeof s.name === "string" ? s.name.slice(0, 24) : "";
  s.coins = num(s.coins); s.xp = num(s.xp);
  const avatarIds = ctx && ctx.avatars ? ctx.avatars.map((a) => a.id) : null;
  s.owned = [...new Set(["estagio", ...(Array.isArray(s.owned) ? s.owned : [])])].filter((id) => !avatarIds || avatarIds.includes(id));
  if (!s.owned.includes(s.avatar)) s.avatar = "estagio";
  s.progress = s.progress && typeof s.progress === "object" && !Array.isArray(s.progress) ? s.progress : {};
  const sites = {};
  if (s.sites && typeof s.sites === "object" && ctx && ctx.sites) {
    for (const [id, cfg] of Object.entries(s.sites)) {
      const site = ctx.sites.find((x) => x.id === id);
      if (site && validSiteConfig(site, cfg, ctx.operators)) sites[id] = cfg.map((r) => r.slice());
    }
  }
  s.sites = sites;
  return s;
}
