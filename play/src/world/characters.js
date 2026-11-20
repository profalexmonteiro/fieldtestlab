import * as THREE from "three/webgpu";
import { save } from "../core/base.js";
import { box, cyl, label, mat, scene, sphere } from "../core/renderer.js";
import { makeScreen } from "../ui/screens.js";
import { stations } from "./lab.js";
import { avatarSpec } from "../ui/avatarSvg.js";
import { emit } from "../core/events.js";

// ======================================================================
// Personagens: engenheiro (avatar) e supervisora (NPC)
// ======================================================================
// Cápsula vertical pendurada no pivô do grupo (articulação): o topo fica em y = top.
function capsule(r, len, color, x, top, z, parent, sx = 1, sz = 1) {
  const m = new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 8, 20), mat(color));
  m.position.set(x, top - (len / 2 + r), z); m.scale.set(sx, 1, sz);
  m.castShadow = true; m.receiveShadow = true; parent.add(m); return m;
}
function buildEngineer(spec) {
  const g = new THREE.Group(), p = {};
  const pants = "#2b3b52", skin = spec.skin;
  const torsoColor = spec.outfit === "vest" ? "#46566E" : spec.outfitColor;
  const sleeve = spec.outfit === "vest" ? "#46566E" : spec.outfitColor;
  // pernas: cápsula da coxa ao tornozelo e sapato arredondado (pivô no quadril)
  const legGroup = (x) => {
    const lg = new THREE.Group(); lg.position.set(x, 0.86, 0); g.add(lg);
    capsule(0.1, 0.6, pants, 0, 0.02, 0, lg);
    box(0.2, 0.11, 0.32, "#1b1f27", 0, -0.86, 0.05, lg);
    return lg;
  };
  p.legL = legGroup(-0.12); p.legR = legGroup(0.12);
  box(0.46, 0.2, 0.3, pants, 0, 0.78, 0, g);                                         // quadril
  capsule(0.2, 0.3, torsoColor, 0, 1.6, 0, g, 1.35, 0.85);                            // tronco (0,88 → 1,60)
  if (spec.outfit === "coat") {                                                       // jaleco com volume
    const skirt = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.34, 0.56, 28, 1, true), mat("#FFFFFF", { side: THREE.DoubleSide }));
    skirt.position.set(0, 0.86, 0); skirt.scale.z = 0.66; g.add(skirt);
    capsule(0.205, 0.3, "#FFFFFF", 0, 1.61, 0, g, 1.36, 0.86);
    [-1, 1].forEach((sgn) => { const lapel = box(0.1, 0.36, 0.02, "#E9EEF4", sgn * 0.08, 1.12, 0.175, g); lapel.rotation.z = sgn * 0.25; });
    box(0.03, 0.12, 0.02, "#2f63c9", 0.15, 1.22, 0.18, g);                           // caneta no bolso
  }
  if (spec.outfit === "vest") {                                                       // colete refletivo
    capsule(0.21, 0.26, spec.outfitColor, 0, 1.56, 0, g, 1.37, 0.88);
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.27, 0.025, 8, 32), mat("#F4F6F9", { metalness: 0.3, roughness: 0.3 }));
    band.rotation.x = Math.PI / 2; band.scale.set(1, 0.66, 1); band.position.y = 1.12; g.add(band);
  }
  if (spec.outfit === "suit") { box(0.12, 0.3, 0.02, "#FFFFFF", 0, 1.22, 0.165, g); box(0.05, 0.28, 0.02, "#FF6B00", 0, 1.2, 0.175, g); }
  if (spec.outfit === "hoodie") {
    const hood = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.06, 10, 24, Math.PI), mat(spec.outfitColor));
    hood.rotation.set(-0.3, 0, Math.PI); hood.position.set(0, 1.58, -0.12); g.add(hood);
  }
  // braços: cápsula do ombro ao punho e mão arredondada (pivô no ombro)
  const armGroup = (x) => {
    const ag = new THREE.Group(); ag.position.set(x, 1.48, 0); g.add(ag);
    sphere(0.072, sleeve, 0, -0.02, 0, ag);                                           // ombro
    capsule(0.07, 0.48, sleeve, 0, 0.04, 0, ag);
    const hand = sphere(0.072, skin, 0, -0.66, 0, ag); hand.scale.set(0.85, 1.15, 0.7);
    return ag;
  };
  p.armL = armGroup(-0.32); p.armR = armGroup(0.32);
  cyl(0.065, 0.07, 0.14, skin, 0, 1.5, 0, g);                                         // pescoço
  const head = new THREE.Group(); head.position.set(0, 1.8, 0); g.add(head); p.head = head;
  sphere(0.21, skin, 0, 0, 0, head).scale.set(1, 1.08, 1);
  [-1, 1].forEach((sgn) => sphere(0.045, skin, sgn * 0.205, 0, 0, head).scale.set(0.5, 1, 0.8));   // orelhas
  sphere(0.032, skin, 0, -0.025, 0.205, head);                                       // nariz
  sphere(0.028, "#0A192F", -0.075, 0.035, 0.19, head); sphere(0.028, "#0A192F", 0.075, 0.035, 0.19, head);
  [-1, 1].forEach((sgn) => box(0.07, 0.014, 0.012, spec.hairColor || "#2b1d14", sgn * 0.075, 0.085, 0.195, head));   // sobrancelhas
  p.mouth = box(0.09, 0.018, 0.02, "#7a3b2a", 0, -0.095, 0.195, head);
  const hc = spec.hairColor;
  if (spec.hair !== "none") { const cap = new THREE.Mesh(new THREE.SphereGeometry(0.235, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2.1), mat(hc)); cap.position.y = 0.02; cap.rotation.x = -0.25; head.add(cap); }
  if (spec.hair === "long") box(0.4, 0.4, 0.12, hc, 0, -0.32, -0.14, head);
  if (spec.hair === "bun") sphere(0.1, hc, 0, 0.2, -0.16, head);
  if (spec.hair === "curly") [[-0.15, 0.12], [0.15, 0.12], [0, 0.2], [-0.08, 0.18], [0.08, 0.18]].forEach(([x, y]) => sphere(0.09, hc, x, y, -0.03, head));
  const hat = spec.hatColor || "#FFC21A";
  if (spec.hat === "helmet") { const hm = new THREE.Mesh(new THREE.SphereGeometry(0.255, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), mat(hat)); hm.position.y = 0.04; head.add(hm); cyl(0.28, 0.28, 0.03, hat, 0, 0.03, 0.02, head); }
  if (spec.hat === "cap") { const hm = new THREE.Mesh(new THREE.SphereGeometry(0.24, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), mat(hat)); hm.position.y = 0.05; head.add(hm); box(0.26, 0.02, 0.18, hat, 0, 0.05, 0.22, head); }
  if (spec.hat === "headset") { const t = new THREE.Mesh(new THREE.TorusGeometry(0.235, 0.02, 10, 32, Math.PI), mat("#0A192F")); t.rotation.y = Math.PI / 2; t.position.y = 0.02; head.add(t); sphere(0.06, "#0A192F", -0.22, 0, 0, head); sphere(0.06, "#0A192F", 0.22, 0, 0, head); }
  if (spec.hat === "visor") box(0.42, 0.08, 0.06, hat, 0, 0, 0.18, head);
  if (spec.hat === "crown") { cyl(0.16, 0.16, 0.12, hat, 0, 0.19, 0, head, 8); sphere(0.025, "#c63b3b", 0, 0.27, 0.15, head); }
  if (spec.acc === "glasses") box(0.32, 0.06, 0.02, "#0A192F", 0, 0.02, 0.2, head);
  if (spec.acc === "badge") box(0.1, 0.13, 0.02, "#FFFFFF", 0.14, 1.2, 0.17, g);
  if (spec.acc === "antenna") { cyl(0.012, 0.012, 0.6, "#46566E", 0.18, 1.4, -0.16, g, 6); sphere(0.04, "#FF6B00", 0.18, 2.02, -0.16, g); }
  if (spec.acc === "phone") box(0.06, 0.12, 0.02, "#0A192F", 0, -0.74, 0.07, p.armR);
  if (spec.glow) { const ring = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.025, 8, 40), mat("#FFC21A", { emissive: "#FFC21A", emissiveIntensity: 0.8 })); ring.rotation.x = Math.PI / 2; ring.position.y = 0.05; g.add(ring); }
  // EPI: capacete, cinto paraquedista e talabarte
  p.epi = new THREE.Group(); g.add(p.epi);
  [-0.13, 0.13].forEach((x) => { box(0.06, 0.62, 0.02, "#FF6B00", x, 0.9, 0.17, p.epi); box(0.06, 0.62, 0.02, "#FF6B00", x, 0.9, -0.17, p.epi); });
  const belt = new THREE.Mesh(new THREE.TorusGeometry(0.29, 0.04, 10, 36), mat("#FF6B00")); belt.rotation.x = Math.PI / 2; belt.scale.set(1, 0.66, 1); belt.position.y = 0.96; p.epi.add(belt);
  box(0.3, 0.05, 0.02, "#FF6B00", 0, 1.3, 0.175, p.epi);
  const hook = new THREE.Mesh(new THREE.TorusGeometry(0.035, 0.008, 6, 12), mat("#C9D1DD")); hook.position.set(0, 1.22, -0.2); p.epi.add(hook);
  if (spec.hat !== "helmet") { const hm = new THREE.Mesh(new THREE.SphereGeometry(0.265, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), mat("#FFC21A")); hm.position.set(0, 1.84, 0); p.epi.add(hm); cyl(0.29, 0.29, 0.03, "#FFC21A", 0, 1.83, 0.02, p.epi); }
  p.epi.visible = false;
  p.crate = box(0.7, 0.5, 0.45, "#C98F63", 0, 1.15, 0.4, g); p.crate.visible = false;
  box(0.72, 0.06, 0.47, "#9a6a43", 0, 0, 0, p.crate).position.y = 0.25;
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return { g, p };
}

const player = { pos: new THREE.Vector3(0, 0, 12), y: 0, vy: 0, epi: false, climbY: 0, climbPhase: 0, rot: Math.PI, walk: 0, model: null, parts: null, carrying: false };
function rebuildPlayer() {
  if (player.model) scene.remove(player.model);
  const spec = avatarSpec(save.avatar);
  const { g, p } = buildEngineer(spec);
  player.model = g; player.parts = p; scene.add(g);
  p.crate.visible = player.carrying; p.epi.visible = player.epi;
  emit("player:rebuilt", spec);
}

// NPC: supervisora Lia
const NPC_SPEC = { skin: "#8D5A3B", hair: "bun", hairColor: "#140E0A", outfit: "suit", outfitColor: "#2f63c9", hat: "none", acc: "badge" };
const npc = { home: new THREE.Vector3(-2.6, 0, -21.6), pos: new THREE.Vector3(-2.6, 0, -21.6), rot: 0, walk: 0, state: "idle", cooldown: 0 };
(function buildNpc() {
  const { g, p } = buildEngineer(NPC_SPEC);
  npc.model = g; npc.parts = p; scene.add(g);
  box(0.16, 0.24, 0.02, "#0A192F", 0, -0.82, 0.08, p.armL);          // tablet da supervisora
  npc.alert = label("!", { scale: 0.22, bg: "#FF6B00", border: "#FFFFFF", color: "#0A192F" }); npc.alert.scale.set(0.3, 0.3, 1); scene.add(npc.alert);
  npc.tag = label("Lia · supervisora", { scale: 0.42 }); scene.add(npc.tag);
  npc.bubble = makeScreen(1000, 620, 1.45, 0.9); npc.bubble.mesh.visible = false; scene.add(npc.bubble.mesh);
})();
stations.npc = { pos: npc.pos, label: null };

export { npc, player, rebuildPlayer };
