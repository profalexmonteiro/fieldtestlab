import * as THREE from "three/webgpu";
import { $ } from "./base.js";
import { emit } from "./events.js";

// ======================================================================
// Renderizador WebGPU (cai para WebGL 2 sozinho) e cena
// ======================================================================
const params = new URLSearchParams(location.search);
const canvas = $("#scene");
const renderer = new THREE.WebGPURenderer({ canvas, antialias: true, forceWebGL: params.get("renderer") === "webgl" });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene();
scene.background = new THREE.Color("#bcd7ee");
scene.fog = new THREE.Fog("#bcd7ee", 45, 95);
const camera = new THREE.PerspectiveCamera(55, 1, 0.03, 200);
scene.add(camera);

const hemi = new THREE.HemisphereLight(0xffffff, 0x6f7f62, 1.7); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffffff, 2.4);
sun.position.set(14, 26, 12);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -32, right: 32, top: 32, bottom: -32, near: 1, far: 80 });
scene.add(sun);
const labLight = new THREE.PointLight(0xfff3e0, 0, 22, 0);
labLight.position.set(0, 3, -16);
scene.add(labLight);

function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h; camera.updateProjectionMatrix();
  emit("resize");
}
window.addEventListener("resize", () => resize());

// ---------- Fábrica de objetos ----------
const mats = {};
const mat = (color, o) => {
  const k = color + JSON.stringify(o || {});
  return mats[k] || (mats[k] = new THREE.MeshStandardMaterial({ color, roughness: 0.75, metalness: 0.05, ...(o || {}) }));
};
// box(largura, altura, profundidade, cor, x, yBase, z): y é a base do objeto
function box(w, h, d, color, x, y, z, parent, o) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), o && o.material ? o.material : mat(color, o));
  m.position.set(x, y + h / 2, z);
  m.castShadow = true; m.receiveShadow = true;
  (parent || scene).add(m);
  return m;
}
function cyl(rt, rb, h, color, x, y, z, parent, seg) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg || 16), mat(color));
  m.position.set(x, y + h / 2, z); m.castShadow = true; m.receiveShadow = true;
  (parent || scene).add(m); return m;
}
function sphere(r, color, x, y, z, parent, o) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, 18, 14), mat(color, o));
  m.position.set(x, y, z); m.castShadow = true; (parent || scene).add(m); return m;
}
const colliders = [];
const addCollider = (cx, cz, w, d) => colliders.push({ minX: cx - w / 2, maxX: cx + w / 2, minZ: cz - d / 2, maxZ: cz + d / 2 });
function collide(nx, nz, r) {
  r = r || 0.35;
  for (const c of colliders) if (nx > c.minX - r && nx < c.maxX + r && nz > c.minZ - r && nz < c.maxZ + r) return true;
  return false;
}
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}
function canvasTex(w, h) {
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return { c, t, x: c.getContext("2d") };
}
function label(text, o) {
  o = o || {};
  const { c, t, x: ctx } = canvasTex(512, 128);
  ctx.fillStyle = o.bg || "rgba(10,25,47,0.92)"; roundRect(ctx, 4, 4, 504, 120, 26); ctx.fill();
  ctx.strokeStyle = o.border || "#FF6B00"; ctx.lineWidth = 6; ctx.stroke();
  ctx.fillStyle = o.color || "#FFFFFF"; let fs = 50; ctx.font = `bold ${fs}px Inter, Segoe UI, Arial, sans-serif`;
  while (ctx.measureText(text).width > 470 && fs > 20) { fs -= 2; ctx.font = `bold ${fs}px Inter, Segoe UI, Arial, sans-serif`; }
  ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(text, 256, 66);
  t.needsUpdate = true;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true }));
  const sc = o.scale || 1; s.scale.set(2.4 * sc, 0.6 * sc, 1);
  return s;
}
function wall(x1, z1, x2, z2, h, color) {
  const t = 0.3, w = Math.abs(x2 - x1) || t, d = Math.abs(z2 - z1) || t;
  const m = box(w, h, d, color, (x1 + x2) / 2, 0, (z1 + z2) / 2);
  addCollider((x1 + x2) / 2, (z1 + z2) / 2, w, d);
  return m;
}

export { addCollider, box, camera, canvas, canvasTex, collide, colliders, cyl, hemi, labLight, label, mat, renderer, resize, roundRect, scene, sphere, sun, wall };
