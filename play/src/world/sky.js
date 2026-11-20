import * as THREE from "three/webgpu";
import { G } from "../core/store.js";
import { clamp, pad2, toast } from "../core/base.js";
import { camera, canvasTex, hemi, labLight, scene, sun } from "../core/renderer.js";

// ======================================================================
// Mundo externo: rua, torre com escada, RRUs, rack RAN, carro e árvores
// ======================================================================
// ======================================================================
// Céu dinâmico: manhã ensolarada, tarde e noite estrelada (com transições), Sol e Lua
// ======================================================================
const SKY_STOPS = { morning: ["#2f7fd6", "#7dbcf0", "#d8eefc"], afternoon: ["#34497f", "#e98a57", "#ffd7a1"], night: ["#02040d", "#0a1430", "#1b2a52"] };
function skyTexture(kind) {
  const { t, x } = canvasTex(2048, 1024), W = 2048, H = 1024, st = SKY_STOPS[kind];
  const g = x.createLinearGradient(0, 0, 0, H / 2);
  g.addColorStop(0, st[0]); g.addColorStop(0.62, st[1]); g.addColorStop(1, st[2]);
  x.fillStyle = g; x.fillRect(0, 0, W, H / 2 + 2); x.fillStyle = st[2]; x.fillRect(0, H / 2, W, H / 2);
  if (kind === "night") {
    x.globalAlpha = 0.035;                                        // via láctea
    for (let i = 0; i < 900; i++) { const u = Math.random(), sx = u * W, sy = 220 + Math.sin(u * Math.PI * 2) * 80 + (Math.random() - 0.5) * 70; x.fillStyle = "#c9d6ff"; x.beginPath(); x.arc(sx, sy, 4 + Math.random() * 10, 0, 7); x.fill(); }
    for (let i = 0; i < 3200; i++) {                              // estrelas
      const sx = Math.random() * W, sy = Math.random() * H * 0.5, big = Math.random() < 0.05;
      x.globalAlpha = (0.35 + Math.random() * 0.65) * (1 - (sy / (H * 0.5)) * 0.6);
      x.fillStyle = Math.random() < 0.12 ? "#ffe9c4" : Math.random() < 0.1 ? "#cfe0ff" : "#ffffff";
      x.beginPath(); x.arc(sx, sy, big ? 1.1 : 0.45 + Math.random() * 0.35, 0, 7); x.fill();
    }
    x.globalAlpha = 1;
  } else {
    const cloud = kind === "morning" ? "rgba(255,255,255,0.88)" : "rgba(255,206,176,0.78)";
    for (let i = 0; i < 34; i++) {
      const cx = Math.random() * W, cy = 140 + Math.random() * 300, s = 36 + Math.random() * 70;
      x.fillStyle = cloud;
      for (let j = 0; j < 7; j++) { x.beginPath(); x.ellipse(cx + (j - 3) * s * 0.55, cy + Math.sin(j * 1.7) * s * 0.22, s, s * 0.42, 0, 0, 7); x.fill(); }
    }
  }
  t.needsUpdate = true; return t;
}
// camadas: noite (fundo, opaca), tarde e manhã por cima com opacidade variável
const skyLayers = ["night", "afternoon", "morning"].map((k, i) => {
  const m = new THREE.Mesh(new THREE.SphereGeometry(160 - i * 4, 48, 24), new THREE.MeshBasicMaterial({ map: skyTexture(k), side: THREE.BackSide, transparent: i > 0, depthWrite: false, fog: false }));
  m.renderOrder = -10 + i; m.frustumCulled = false; scene.add(m); return m;
});
function glowTexture(inner, outer) {
  const { t, x } = canvasTex(256, 256), g = x.createRadialGradient(128, 128, 0, 128, 128, 128);
  g.addColorStop(0, inner); g.addColorStop(0.22, inner); g.addColorStop(0.5, outer); g.addColorStop(1, "rgba(0,0,0,0)");
  x.fillStyle = g; x.fillRect(0, 0, 256, 256); t.needsUpdate = true; return t;
}
const sky = { hour: 9, skip: null, w: [1, 0, 0] };
sky.sun = new THREE.Mesh(new THREE.SphereGeometry(5, 24, 16), new THREE.MeshBasicMaterial({ color: "#fff4c8", fog: false }));
sky.sunGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture("rgba(255,244,200,0.9)", "rgba(255,190,110,0.25)"), blending: THREE.AdditiveBlending, depthWrite: false, fog: false, transparent: true }));
sky.sunGlow.scale.set(46, 46, 1);
const moonTex = canvasTex(256, 128);
moonTex.x.fillStyle = "#dfe6f5"; moonTex.x.fillRect(0, 0, 256, 128);
for (let i = 0; i < 40; i++) { moonTex.x.fillStyle = `rgba(120,132,160,${0.15 + Math.random() * 0.3})`; moonTex.x.beginPath(); moonTex.x.arc(Math.random() * 256, Math.random() * 128, 3 + Math.random() * 12, 0, 7); moonTex.x.fill(); }
moonTex.t.needsUpdate = true;
sky.moon = new THREE.Mesh(new THREE.SphereGeometry(3.6, 24, 16), new THREE.MeshBasicMaterial({ map: moonTex.t, fog: false }));
sky.moonGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture("rgba(200,215,255,0.55)", "rgba(120,140,220,0.12)"), blending: THREE.AdditiveBlending, depthWrite: false, fog: false, transparent: true }));
sky.moonGlow.scale.set(26, 26, 1);
[sky.sun, sky.sunGlow, sky.moon, sky.moonGlow].forEach((o) => { o.renderOrder = -5; o.frustumCulled = false; scene.add(o); });
const HOUR_SECONDS = 25;                       // 1 hora de jogo = 25 s (dia completo ≈ 10 min)
const SKY_KEYS = [[0, [0, 0, 1]], [5, [0, 0, 1]], [7, [1, 0, 0]], [12.5, [1, 0, 0]], [15, [0, 1, 0]], [18, [0, 1, 0]], [20, [0, 0, 1]], [24, [0, 0, 1]]];
function skyWeights(h) {
  for (let i = 0; i < SKY_KEYS.length - 1; i++) {
    const [h0, a] = SKY_KEYS[i], [h1, b] = SKY_KEYS[i + 1];
    if (h >= h0 && h <= h1) { const f = (h - h0) / (h1 - h0), s = f * f * (3 - 2 * f); return a.map((v, j) => v + (b[j] - v) * s); }
  }
  return [0, 0, 1];
}
const _c1 = new THREE.Color(), _c2 = new THREE.Color();
function blendColor(cols, w) { _c1.setRGB(0, 0, 0); cols.forEach((c, i) => { _c2.set(c); _c1.r += _c2.r * w[i]; _c1.g += _c2.g * w[i]; _c1.b += _c2.b * w[i]; }); return _c1; }
function skipTime() {
  const starts = [[7, "a manhã"], [15, "a tarde"], [20.5, "a noite"]];
  const next = starts.find(([h]) => h > sky.hour + 0.2) || starts[0];
  sky.skip = next[0]; toast("Avançando para " + next[1] + "…");
}
function updateSky(dt) {
  if (sky.skip !== null) {
    const remaining = (sky.skip - sky.hour + 24) % 24, step = Math.min(remaining, dt * 3.5);
    sky.hour += step; if (remaining <= dt * 3.5) sky.skip = null;
  } else sky.hour += dt / HOUR_SECONDS;
  sky.hour %= 24;
  const w = (sky.w = skyWeights(sky.hour)), [wM, wA, wN] = w;
  skyLayers[1].material.opacity = 1 - wN;
  skyLayers[2].material.opacity = wM / Math.max(1e-3, wM + wA);
  skyLayers.forEach((m) => m.position.copy(camera.position));
  const a = ((sky.hour - 6) / 12) * Math.PI;
  const sunDir = new THREE.Vector3(-Math.cos(a), Math.sin(a), -0.35).normalize();
  const moonDir = new THREE.Vector3(Math.cos(a), -Math.sin(a), -0.25).normalize();
  sky.sun.position.copy(camera.position).addScaledVector(sunDir, 130); sky.sunGlow.position.copy(sky.sun.position);
  sky.moon.position.copy(camera.position).addScaledVector(moonDir, 130); sky.moonGlow.position.copy(sky.moon.position);
  sky.moon.lookAt(camera.position);
  sky.sun.visible = sky.sunGlow.visible = sunDir.y > -0.08;
  sky.moon.visible = sky.moonGlow.visible = moonDir.y > -0.08;
  sky.sun.material.color.set(sunDir.y < 0.25 ? "#ffb878" : "#fff4c8");
  const sunUp = clamp(sunDir.y * 4, 0, 1), moonUp = clamp(moonDir.y * 4, 0, 1);
  if (sunDir.y > -0.02) {
    sun.position.copy(sunDir).multiplyScalar(40); sun.intensity = 2.5 * sunUp;
    sun.color.set("#ffffff").lerp(_c2.set("#ffb070"), Math.max(wA * 0.6, 1 - sunUp));
  } else { sun.position.copy(moonDir).multiplyScalar(40); sun.intensity = 0.5 * moonUp; sun.color.set("#9fb6ff"); }
  hemi.intensity = 0.36 + 0.95 * (wM + wA * 0.8);
  // reflexos do ambiente acompanham o dia; dentro do laboratório o panorama do céu quase não aparece
  scene.environmentIntensity = (0.12 + 0.45 * (wM + wA * 0.8)) * (G.inside ? 0.3 : 1);
  hemi.color.copy(blendColor(["#ffffff", "#ffe1c4", "#7f93c8"], w));
  hemi.groundColor.copy(blendColor(["#6f7f62", "#7a6450", "#1f2a3a"], w));
  const horizon = blendColor(["#d8eefc", "#ffd7a1", "#1b2a52"], w);
  scene.fog.color.copy(horizon); scene.background.copy(horizon);
  labLight.intensity = G.inside ? 1.1 + 1.8 * wN : 0;
  const hh = Math.floor(sky.hour), mm = Math.floor((sky.hour - hh) * 60);
  const ck = document.getElementById("clock");
  if (ck) ck.textContent = `${wN > 0.5 ? "🌙 Noite" : wA > 0.5 ? "🌇 Tarde" : "☀️ Manhã"} ${pad2(hh)}:${pad2(Math.floor(mm / 5) * 5)}`;
}

export { skipTime, updateSky };
