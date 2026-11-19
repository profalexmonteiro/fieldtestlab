import * as THREE from "three/webgpu";
import { G } from "./store.js";
import { $, clamp } from "./base.js";
import { camera, canvas } from "./renderer.js";
import { paint, screens } from "../ui/screens.js";
import { skipTime } from "../world/sky.js";
import { world } from "../world/world.js";
import { player } from "../world/characters.js";
import { modeTypes } from "../game/registry.js";
import { on } from "./events.js";
import { mode } from "../game/state.js";

// ======================================================================
// Entrada: teclado, mouse, toque e cliques nas telas
// ======================================================================
const keys = {};
G.camYaw = 0; G.camPitch = 0.42; let camDist = 7.5; let dragging = false; let lastX = 0; let lastY = 0; let downX = 0; let downY = 0;
const PITCH_MIN = -0.5, PITCH_MAX = 1.35;
const joy = { x: 0, y: 0, id: null };
const nameInput = $("#nameInput");
const typing = () => document.activeElement === nameInput || /INPUT|TEXTAREA/.test(document.activeElement && document.activeElement.tagName);
const raycaster = new THREE.Raycaster(), ndc = new THREE.Vector2();
function rayFrom(e) { const r = canvas.getBoundingClientRect(); ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); raycaster.setFromCamera(ndc, camera); }
const activeScreens = () => screens.filter((s) => s.active);
function screenHit(e) {
  const act = activeScreens(); if (!act.length) return null;
  rayFrom(e);
  const h = raycaster.intersectObjects(act.map((s) => s.mesh), false)[0]; if (!h || !h.uv) return null;
  const s = h.object.userData.screen, px = h.uv.x * s.W, py = (1 - h.uv.y) * s.H;
  return { s, i: s.buttons.findIndex((b) => !b.disabled && px >= b.x && px <= b.x + b.w && py >= b.y && py <= b.y + b.h) };
}
function pickCabinetItem(e) {
  rayFrom(e);
  const hit = raycaster.intersectObjects(world.cab.items, true)[0];
  let o = hit && hit.object; while (o && !o.userData.key) o = o.parent;
  return o ? o.userData.key : null;
}
function pressButton(b) { if (!b || b.disabled) return; b.onClick(); }
function screenKey(code) {
  for (const s of activeScreens()) {
    const b = s.buttons.find((bt) => !bt.disabled && (bt.key === code || (bt.primary && (code === "Enter" || code === "KeyE"))));
    if (b) { pressButton(b); return true; }
  }
  return false;
}
window.addEventListener("keydown", (e) => {
  if (typing()) return;
  keys[e.code] = true;
  if (mode !== "free" && mode !== "climb" && screenKey(e.code)) { e.preventDefault(); return; }
  if (e.code === "KeyE" || e.code === "Enter") { e.preventDefault(); const b = $("#prompt button:not(.sec):not([disabled])"); if (b) b.click(); }
  if (e.code === "KeyM" && !e.repeat) modeTypes[mode]?.measure?.();
  if (e.code === "Space") { e.preventDefault(); if (!e.repeat) jump(); }
  if (e.code === "KeyT" && !e.repeat && (mode === "free" || mode === "climb" || mode === "drive")) skipTime();
  if (e.code === "Escape") escape();
});
window.addEventListener("keyup", (e) => { keys[e.code] = false; });
window.addEventListener("blur", () => { for (const k in keys) keys[k] = false; });
canvas.addEventListener("pointerdown", (e) => { dragging = true; lastX = downX = e.clientX; lastY = downY = e.clientY; try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* ok */ } });
canvas.addEventListener("pointermove", (e) => {
  if (mode !== "free" && mode !== "climb") {
    const h = screenHit(e);
    screens.forEach((s) => { const want = h && h.s === s ? h.i : -1; if (s.active && s.hover !== want) { s.hover = want; paint(s); } });
    let pointer = h && h.i >= 0;
    if (mode === "cabinet" && !pointer) { const k = pickCabinetItem(e); pointer = !!k; modeTypes.cabinet.hover(k || null); }
    canvas.style.cursor = pointer ? "pointer" : "";
    return;
  }
  if (!dragging) return;
  G.camYaw -= (e.clientX - lastX) * 0.008;
  G.camPitch = clamp(G.camPitch + (e.clientY - lastY) * 0.006, PITCH_MIN, PITCH_MAX);
  lastX = e.clientX; lastY = e.clientY;
});
canvas.addEventListener("pointerup", (e) => {
  dragging = false;
  if (Math.hypot(e.clientX - downX, e.clientY - downY) > 8 || mode === "free" || mode === "climb") return;
  const h = screenHit(e);
  if (h && h.i >= 0) { pressButton(h.s.buttons[h.i]); return; }
  if (mode === "cabinet") { const k = pickCabinetItem(e); if (k) modeTypes.cabinet.pick(k); }
});
canvas.addEventListener("wheel", (e) => { e.preventDefault(); if (mode === "free" || mode === "climb") camDist = clamp(camDist * (e.deltaY > 0 ? 1.1 : 0.9), 2.5, 14); }, { passive: false });
function jump() { if (mode !== "free" || player.y > 0.001) return; player.vy = 6.2; }
const joyEl = $("#joy"), knob = joyEl.querySelector("i");
joyEl.addEventListener("pointerdown", (e) => { joy.id = e.pointerId; joyEl.setPointerCapture(e.pointerId); moveJoy(e); });
joyEl.addEventListener("pointermove", (e) => { if (joy.id === e.pointerId) moveJoy(e); });
const endJoy = () => { joy.id = null; joy.x = joy.y = 0; knob.style.transform = ""; };
joyEl.addEventListener("pointerup", endJoy); joyEl.addEventListener("pointercancel", endJoy);
function moveJoy(e) {
  const r = joyEl.getBoundingClientRect();
  let dx = (e.clientX - r.left - r.width / 2) / (r.width / 2), dy = (e.clientY - r.top - r.height / 2) / (r.height / 2);
  const len = Math.hypot(dx, dy); if (len > 1) { dx /= len; dy /= len; }
  joy.x = dx; joy.y = dy; knob.style.transform = `translate(${dx * 35}px, ${dy * 35}px)`;
}
// Esc: cada modo declara o que fazer (game/registry.js)
function escape() {
  if (G.busy) return;
  const md = modeTypes[mode];
  if (md && md.escape) md.escape();
}
on("mode:changed", () => { for (const k in keys) keys[k] = false; });


export { PITCH_MAX, PITCH_MIN, activeScreens, camDist, joy, keys, nameInput, typing };
