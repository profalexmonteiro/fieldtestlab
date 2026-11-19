import * as THREE from "three/webgpu";
import { canvasTex, roundRect } from "../core/renderer.js";

// ======================================================================
// Telas interativas dentro do mundo (substituem os pop-ups)
// ======================================================================
const screens = [];
function makeScreen(cw, ch, pw, ph) {
  const tx = canvasTex(cw, ch);
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(pw, ph), new THREE.MeshBasicMaterial({ map: tx.t }));
  const s = { c: tx.c, x: tx.x, t: tx.t, mesh, W: cw, H: ch, k: cw / 1024, buttons: [], hover: -1, render: null, active: false };
  mesh.userData.screen = s; screens.push(s);
  return s;
}
function paint(s) { if (!s) return; s.buttons = []; if (s.render) s.render(s); s.t.needsUpdate = true; }
function setScreen(s, render) { s.render = render; s.hover = -1; paint(s); }
function dropScreen(s) { const i = screens.indexOf(s); if (i >= 0) screens.splice(i, 1); }

function wrapText(x, text, maxW) {
  const out = [];
  String(text).split("\n").forEach((para) => {
    const words = para.split(" "); let line = "";
    for (const w of words) { const test = line ? line + " " + w : w; if (x.measureText(test).width > maxW && line) { out.push(line); line = w; } else line = test; }
    out.push(line);
  });
  return out;
}
const FONT = "Inter, Segoe UI, Arial, sans-serif";
const UI = {
  bg(s, color) { s.x.fillStyle = color || "#F4F6F9"; s.x.fillRect(0, 0, s.W, s.H); },
  header(s, title, right, color) {
    const k = s.k, x = s.x;
    x.fillStyle = color || "#0A192F"; x.fillRect(0, 0, s.W, 64 * k);
    x.textBaseline = "alphabetic"; x.textAlign = "left"; x.fillStyle = "#FF6B00"; x.font = `bold ${30 * k}px ${FONT}`; x.fillText(title, 24 * k, 43 * k);
    if (right) { x.textAlign = "right"; x.fillStyle = "#C9D6E8"; x.font = `${26 * k}px ${FONT}`; x.fillText(right, s.W - 24 * k, 43 * k); }
    return 64 * k;
  },
  // escreve texto com quebra de linha; devolve o y final
  text(s, str, xx, y, o) {
    o = o || {}; const k = s.k, x = s.x, size = (o.size || 24) * k;
    x.font = `${o.weight || ""} ${size}px ${o.mono ? "Consolas, monospace" : FONT}`.trim();
    x.fillStyle = o.color || "#0A192F"; x.textAlign = o.align || "left"; x.textBaseline = "alphabetic";
    const lh = (o.lh || (o.size || 24) * 1.3) * k;
    let lines = o.maxW ? wrapText(x, str, o.maxW) : [String(str)];
    if (o.maxLines && lines.length > o.maxLines) { lines = lines.slice(0, o.maxLines); lines[lines.length - 1] += " …"; }
    lines.forEach((l, i) => x.fillText(l, xx, y + size + i * lh));
    return y + size + (lines.length - 1) * lh + size * 0.35;
  },
  // botão clicável; kind: primary | ghost | opt | ok | bad | sel | dim
  btn(s, bx, by, bw, bh, text, onClick, o) {
    o = o || {}; const k = s.k, x = s.x, idx = s.buttons.length, hov = s.hover === idx && !o.disabled;
    const kind = o.kind || "opt";
    const fills = { primary: hov ? "#FF8124" : "#FF6B00", ghost: hov ? "#E1E6EE" : "#FFFFFF", opt: hov ? "#FFF1E6" : "#FFFFFF", ok: "#E8F6EF", bad: "#FDEEEE", sel: "#FFF1E6", dim: "#EDF1F6", dark: hov ? "#24406a" : "#172A45" };
    const strokes = { primary: "#B54800", ghost: "#C9D1DD", opt: hov ? "#FF6B00" : "#C9D1DD", ok: "#15724a", bad: "#c63b3b", sel: "#FF6B00", dim: "#E1E6EE", dark: hov ? "#FF6B00" : "#2f4a72" };
    x.fillStyle = fills[kind]; roundRect(x, bx, by, bw, bh, 12 * k); x.fill();
    x.strokeStyle = strokes[kind]; x.lineWidth = (kind === "sel" || kind === "ok" || kind === "bad" ? 4 : 3) * k; x.stroke();
    const size = (o.size || 24) * k;
    let tx = bx + 16 * k;
    if (o.letter) { x.fillStyle = "#FF6B00"; x.font = `bold ${size * 1.1}px ${FONT}`; x.textAlign = "left"; x.textBaseline = "middle"; x.fillText(o.letter, tx, by + bh / 2); tx += 40 * k; }
    x.fillStyle = kind === "primary" ? "#0A192F" : kind === "dark" ? "#F4F6F9" : "#0A192F";
    x.font = `${o.weight || (kind === "primary" ? "bold" : "")} ${size}px ${FONT}`.trim();
    x.textBaseline = "middle";
    if (o.center) { x.textAlign = "center"; x.fillText(text, bx + bw / 2, by + bh / 2); }
    else {
      x.textAlign = "left";
      const lines = wrapText(x, text, bw - (tx - bx) - 14 * k).slice(0, o.maxLines || 3);
      const lh = size * 1.22, y0 = by + bh / 2 - ((lines.length - 1) * lh) / 2;
      lines.forEach((l, i) => x.fillText(l, tx, y0 + i * lh));
    }
    x.textBaseline = "alphabetic";
    s.buttons.push({ x: bx, y: by, w: bw, h: bh, onClick, key: o.key, primary: !!o.primary || kind === "primary", disabled: !!o.disabled, text });
  },
  card(s, bx, by, bw, bh, fill, stroke) { const x = s.x; x.fillStyle = fill || "#FFFFFF"; roundRect(x, bx, by, bw, bh, 12 * s.k); x.fill(); if (stroke) { x.strokeStyle = stroke; x.lineWidth = 3 * s.k; x.stroke(); } },
  lineHeightFor(s, str, size, maxW) { s.x.font = `${size * s.k}px ${FONT}`; return wrapText(s.x, str, maxW).length; }
};
const TONE = { "bad-text": ["#FDEEEE", "#c63b3b"], "warn-text": ["#FFF5DE", "#9a6100"], "good-text": ["#E8F6EF", "#15724a"], "accent-text": ["#EDF2FD", "#2f63c9"], "": ["#FFFFFF", "#C9D1DD"] };

export { FONT, TONE, UI, dropScreen, makeScreen, paint, screens, setScreen };
