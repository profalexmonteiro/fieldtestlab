import { G } from "./store.js";
import { AVATARS, CHALLENGE_DATA, CONTENT, NETWORK } from "../data/index.js";
import { LEVELS, PTS, levelOf, unlocked } from "../rules/score.js";
import { SAVE_KEY, blankSave, migrateSave } from "../rules/save.js";
import { avatarSvg } from "../ui/avatarSvg.js";

// ======================================================================
// Base compartilhada com a versão 2D (mesmo save, pontos e avatares)
// ======================================================================
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const shuffle = (arr) => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const CHALLENGES = CHALLENGE_DATA.map((c) => ({ ...c, game: CONTENT[c.id] }));
// save versionado: qualquer formato antigo passa por migrateSave (rules/save.js)
let save = blankSave();
try { const raw = localStorage.getItem(SAVE_KEY); if (raw) save = migrateSave(JSON.parse(raw), { sites: NETWORK.sites, operators: NETWORK.operators, avatars: AVATARS }); } catch (e) { /* sem storage ou save ilegível */ }
const persist = () => { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) { /* sem storage */ } };
const isRef = (s) => /CDUT/.test(s.device);
const devName = (s) => s.device.split(" / ")[0];
const pad2 = (n) => String(n).padStart(2, "0");
const unlockedChallenges = () => unlocked(CHALLENGES, save.progress);

function toast(text, kind) {
  const t = document.createElement("div");
  t.className = "toast " + (kind || ""); t.textContent = text;
  $("#toasts").appendChild(t);
  setTimeout(() => t.classList.add("out"), 2200); setTimeout(() => t.remove(), 2700);
}

G.backendName = "…";
function hud() {
  const lv = levelOf(save.xp), next = LEVELS[lv + 1];
  const pct = next ? Math.round(((save.xp - LEVELS[lv].xp) / (next.xp - LEVELS[lv].xp)) * 100) : 100;
  const score = G.run ? `<div class="coins" title="Pontuação do desafio">⭐ <b>${G.run.score.setup + G.run.score.tests + G.run.score.report}</b>/${G.run.max}</div>` : "";
  $("#hud").innerHTML = `
    <div class="brand"><span class="logo">FT</span><span><b>FieldTest</b> Quest<small>Laboratório 5G · Site Delta</small></span></div>
    <div class="hud-right"><span class="gpu-badge clock" id="clock" title="Hora do dia · tecla T avança para o próximo período"></span><span class="gpu-badge" title="Renderizador em uso">${G.backendName}</span>${score}
      <div class="coins" title="Pontos para a loja">🪙 <b>${save.coins}</b></div>
      <div class="me"><span class="me-av">${avatarSvg(save.avatar, 40)}</span>
      <span class="me-txt hide-sm"><b>${esc(save.name || "Engenheiro")}</b><small>${LEVELS[lv].title}</small><span class="xpbar"><i style="width:${pct}%"></i></span></span></div>
    </div>`;
}

export { $, CHALLENGES, LEVELS, PTS, clamp, devName, esc, hud, isRef, levelOf, pad2, persist, save, shuffle, toast, unlockedChallenges };
