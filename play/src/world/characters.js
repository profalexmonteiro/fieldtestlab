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
function buildEngineer(spec) {
  const g = new THREE.Group(), p = {};
  const pants = "#2b3b52", skin = spec.skin;
  const torsoColor = spec.outfit === "vest" ? "#46566E" : spec.outfitColor;
  const legGroup = (x) => { const lg = new THREE.Group(); lg.position.set(x, 0.86, 0); g.add(lg); box(0.2, 0.8, 0.22, pants, 0, -0.8, 0, lg); box(0.22, 0.1, 0.32, "#1b1f27", 0, -0.86, 0.05, lg); return lg; };
  p.legL = legGroup(-0.13); p.legR = legGroup(0.13);
  box(0.56, 0.66, 0.32, torsoColor, 0, 0.86, 0, g);
  if (spec.outfit === "coat") { box(0.6, 0.5, 0.34, "#FFFFFF", 0, 0.62, 0, g); box(0.1, 0.4, 0.02, "#2f63c9", 0, 1.1, 0.17, g); }
  if (spec.outfit === "vest") { box(0.58, 0.55, 0.34, spec.outfitColor, 0, 0.9, 0, g); box(0.59, 0.06, 0.35, "#F4F6F9", 0, 1.1, 0, g); }
  if (spec.outfit === "suit") { box(0.12, 0.3, 0.02, "#FFFFFF", 0, 1.22, 0.17, g); box(0.05, 0.28, 0.02, "#FF6B00", 0, 1.2, 0.18, g); }
  if (spec.outfit === "hoodie") box(0.4, 0.12, 0.2, spec.outfitColor, 0, 1.5, -0.12, g);
  const armGroup = (x) => {
    const ag = new THREE.Group(); ag.position.set(x, 1.48, 0); g.add(ag);
    box(0.14, 0.6, 0.16, spec.outfit === "vest" ? "#46566E" : spec.outfitColor, 0, -0.6, 0, ag);
    sphere(0.075, skin, 0, -0.66, 0, ag); return ag;
  };
  p.armL = armGroup(-0.36); p.armR = armGroup(0.36);
  box(0.14, 0.1, 0.14, skin, 0, 1.52, 0, g);
  const head = new THREE.Group(); head.position.set(0, 1.8, 0); g.add(head); p.head = head;
  sphere(0.21, skin, 0, 0, 0, head);
  sphere(0.03, "#0A192F", -0.075, 0.02, 0.19, head); sphere(0.03, "#0A192F", 0.075, 0.02, 0.19, head);
  p.mouth = box(0.1, 0.02, 0.02, "#7a3b2a", 0, -0.09, 0.195, head);
  const hc = spec.hairColor;
  if (spec.hair !== "none") { const cap = new THREE.Mesh(new THREE.SphereGeometry(0.225, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2.1), mat(hc)); cap.position.y = 0.02; cap.rotation.x = -0.25; head.add(cap); }
  if (spec.hair === "long") box(0.4, 0.4, 0.12, hc, 0, -0.32, -0.14, head);
  if (spec.hair === "bun") sphere(0.1, hc, 0, 0.2, -0.16, head);
  if (spec.hair === "curly") [[-0.15, 0.12], [0.15, 0.12], [0, 0.2], [-0.08, 0.18], [0.08, 0.18]].forEach(([x, y]) => sphere(0.09, hc, x, y, -0.03, head));
  const hat = spec.hatColor || "#FFC21A";
  if (spec.hat === "helmet") { const hm = new THREE.Mesh(new THREE.SphereGeometry(0.25, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), mat(hat)); hm.position.y = 0.04; head.add(hm); cyl(0.28, 0.28, 0.03, hat, 0, 0.03, 0.02, head); }
  if (spec.hat === "cap") { const hm = new THREE.Mesh(new THREE.SphereGeometry(0.23, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), mat(hat)); hm.position.y = 0.05; head.add(hm); box(0.26, 0.02, 0.18, hat, 0, 0.05, 0.22, head); }
  if (spec.hat === "headset") { const t = new THREE.Mesh(new THREE.TorusGeometry(0.23, 0.02, 8, 24, Math.PI), mat("#0A192F")); t.rotation.y = Math.PI / 2; t.position.y = 0.02; head.add(t); sphere(0.06, "#0A192F", -0.22, 0, 0, head); sphere(0.06, "#0A192F", 0.22, 0, 0, head); }
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
  box(0.6, 0.07, 0.36, "#FF6B00", 0, 0.92, 0, p.epi); box(0.3, 0.05, 0.02, "#FF6B00", 0, 1.3, 0.175, p.epi);
  const hook = new THREE.Mesh(new THREE.TorusGeometry(0.035, 0.008, 6, 12), mat("#C9D1DD")); hook.position.set(0, 1.22, -0.2); p.epi.add(hook);
  if (spec.hat !== "helmet") { const hm = new THREE.Mesh(new THREE.SphereGeometry(0.255, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), mat("#FFC21A")); hm.position.set(0, 1.84, 0); p.epi.add(hm); cyl(0.29, 0.29, 0.03, "#FFC21A", 0, 1.83, 0.02, p.epi); }
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
