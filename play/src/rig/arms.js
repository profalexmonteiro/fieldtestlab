import * as THREE from "three/webgpu";
import { G } from "../core/store.js";
import { clamp } from "../core/base.js";
import { box, camera, mat, scene, sphere } from "../core/renderer.js";
import { mode } from "../game/state.js";
import { world } from "../world/world.js";
import { on } from "../core/events.js";

// ======================================================================
// Braços em primeira pessoa: braço, cotovelo, antebraço, punho e 5 dedos articulados (IK de 2 ossos)
// ======================================================================
const ARM_A = 0.37, ARM_B = 0.34;
const rig = { group: new THREE.Group(), L: null, R: null, lean: new THREE.Vector3() };
scene.add(rig.group); rig.group.visible = false;
const UNIT_CYL = new THREE.CylinderGeometry(1, 1, 1, 12);
const POSES = {                       // [polegar, indicador, médio, anelar, mínimo]: 0 = esticado, 1 = fechado
  relax: [0.3, 0.25, 0.3, 0.35, 0.42], point: [0.75, 0.0, 1.15, 1.25, 1.3], grip: [0.55, 0.7, 0.75, 0.8, 0.85],
  pinch: [0.7, 0.45, 1.1, 1.2, 1.25], type: [0.25, 0.4, 0.45, 0.5, 0.55], hold: [0.1, 0.55, 0.6, 0.65, 0.7], mouse: [0.3, 0.2, 0.25, 0.55, 0.65]
};
function buildArm(side, spec) {
  const sleeve = spec.outfit === "vest" ? "#46566E" : spec.outfitColor, skin = spec.skin;
  const keep = rig[side < 0 ? "L" : "R"];
  const arm = { side, position: keep ? keep.position.clone() : new THREE.Vector3(), pose: keep ? keep.pose : "relax", curls: POSES.relax.slice(), fingerDir: null, tap: 0 };
  const seg = (color) => { const m = new THREE.Mesh(UNIT_CYL, mat(color)); m.castShadow = true; rig.group.add(m); return m; };
  arm.upper = seg(sleeve); arm.fore = seg(sleeve); arm.cuff = seg("#F4F6F9"); arm.wrist = seg(skin);
  arm.elbow = sphere(0.05, sleeve, 0, 0, 0, rig.group);
  const hand = new THREE.Group(); rig.group.add(hand); arm.hand = hand;
  box(0.084, 0.03, 0.095, skin, 0, -0.015, 0.047, hand);                      // palma (dedos para +z)
  box(0.05, 0.026, 0.03, skin, -side * 0.028, -0.014, 0.012, hand);           // eminência tenar
  arm.fingers = [];
  [[-side * 0.03, [0.034, 0.024, 0.02]], [-side * 0.01, [0.037, 0.026, 0.021]], [side * 0.01, [0.034, 0.024, 0.02]], [side * 0.03, [0.027, 0.019, 0.017]]].forEach(([x, lens]) => {
    const segs = []; let parent = hand;
    lens.forEach((len, i) => {
      const j = new THREE.Group();
      if (i === 0) j.position.set(x, -0.002, 0.093); else j.position.z = lens[i - 1];
      parent.add(j);
      const w = 0.0175 - i * 0.0015;
      box(w, w * 0.9, len + 0.004, skin, 0, -w * 0.45, len / 2, j);
      segs.push(j); parent = j;
    });
    arm.fingers.push(segs);
  });
  const tb = new THREE.Group(); tb.position.set(-side * 0.043, -0.008, 0.028); tb.rotation.set(0.25, -side * 0.75, side * 0.35); hand.add(tb);
  arm.thumbBase = tb;
  const thumb = []; let tp = tb;
  [0.032, 0.025, 0.02].forEach((len, i) => {
    const j = new THREE.Group(); if (i > 0) j.position.z = [0.032, 0.025][i - 1]; tp.add(j);
    box(0.021 - i * 0.002, 0.019, len + 0.004, skin, 0, -0.009, len / 2, j); thumb.push(j); tp = j;
  });
  arm.thumb = thumb;
  hand.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return arm;
}
// posição de descanso das mãos: sobre o teclado/mouse no desktop, na frente da bancada nos demais modos
function handRest(side) {
  if (mode === "desk") return side === "L" ? world.deskInfo.kb.clone().add(new THREE.Vector3(0.1, 0.05, -0.02)) : world.deskInfo.mouse.clone().add(new THREE.Vector3(0.1, 0.045, 0));
  return new THREE.Vector3(world.benchX + (side === "R" ? 0.12 : -0.55), world.benchTop + 0.08, world.benchZ + 0.5);
}
function buildRig(spec) {
  const keepL = rig.L, keepR = rig.R;
  while (rig.group.children.length) rig.group.remove(rig.group.children[0]);
  rig.L = null; rig.R = null;
  rig.L = buildArm(-1, spec); rig.R = buildArm(1, spec);
  if (!keepL) { rig.L.position.copy(handRest("L")); rig.R.position.copy(handRest("R")); }
  else { rig.L.position.copy(keepL.position); rig.R.position.copy(keepR.position); }
}

const _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3(), _q = new THREE.Quaternion(), YUP = new THREE.Vector3(0, 1, 0);
function camBasis(pos, quat) {
  return { right: new THREE.Vector3(1, 0, 0).applyQuaternion(quat), up: new THREE.Vector3(0, 1, 0).applyQuaternion(quat), fwd: new THREE.Vector3(0, 0, -1).applyQuaternion(quat), pos };
}
const shoulderOf = (b, side) => b.pos.clone().addScaledVector(b.right, side * 0.2).addScaledVector(b.up, -0.27).addScaledVector(b.fwd, -0.05);
function fingerDirFor(arm, wrist, shoulder) {
  if (arm.fingerDir) return arm.fingerDir.clone();
  const d = wrist.clone().sub(shoulder); d.y = 0;
  if (d.lengthSq() < 1e-6) d.set(0, 0, -1);
  d.normalize(); d.y = -0.42; return d.normalize();
}
// posição do punho para que a ponta do indicador (pose "apontar") toque o ponto P
function wristForTip(arm, P) {
  const b = camBasis(camera.position, camera.quaternion), S = shoulderOf(b, arm.side);
  const fd = fingerDirFor(arm, P, S);
  return P.clone().addScaledVector(fd, -0.172).add(new THREE.Vector3(0, 0.014, 0));
}
// posição do punho para segurar um objeto sob a palma
function wristForGrip(arm, P) {
  const b = camBasis(camera.position, camera.quaternion), S = shoulderOf(b, arm.side);
  const fd = fingerDirFor(arm, P, S);
  return P.clone().addScaledVector(fd, -0.05).add(new THREE.Vector3(0, 0.045, 0));
}
function placeSeg(m, a, b, r) {
  _v.subVectors(b, a); const len = _v.length();
  m.position.copy(a).addScaledVector(_v, 0.5); m.scale.set(r, Math.max(len, 0.001), r);
  m.quaternion.setFromUnitVectors(YUP, _v.normalize());
}
function updateArm(arm, b, dt) {
  const S = shoulderOf(b, arm.side), W = arm.position;
  const d = _v2.subVectors(W, S); const c = Math.min(d.length(), ARM_A + ARM_B - 0.002), dir = d.clone().normalize();
  const cosA = clamp((ARM_A * ARM_A + c * c - ARM_B * ARM_B) / (2 * ARM_A * Math.max(c, 0.01)), -1, 1), A = Math.acos(cosA);
  const pole = b.right.clone().multiplyScalar(arm.side * 0.65).addScaledVector(b.up, -1).addScaledVector(b.fwd, -0.15);
  const bend = pole.addScaledVector(dir, -pole.dot(dir)).normalize();
  const E = S.clone().addScaledVector(dir, ARM_A * Math.cos(A)).addScaledVector(bend, ARM_A * Math.sin(A));
  const fd = fingerDirFor(arm, W, S);
  const foreEnd = W.clone().addScaledVector(fd, -0.012);
  placeSeg(arm.upper, S, E, 0.05); placeSeg(arm.fore, E, foreEnd.clone().addScaledVector(_v3.subVectors(foreEnd, E).normalize(), -0.045), 0.042);
  const cuffA = foreEnd.clone().addScaledVector(_v3.subVectors(foreEnd, E).normalize(), -0.05);
  placeSeg(arm.cuff, cuffA, foreEnd.clone().addScaledVector(_v3, -0.035), 0.044);
  placeSeg(arm.wrist, foreEnd.clone().addScaledVector(_v3, -0.04), W, 0.03);
  arm.elbow.position.copy(E);
  arm.hand.position.copy(W);
  arm.hand.up.copy(arm.fingerDir ? b.fwd.clone().negate() : YUP);
  arm.hand.lookAt(_v.copy(W).add(fd));
  // dedos
  const target = POSES[arm.pose] || POSES.relax;
  for (let i = 0; i < 5; i++) arm.curls[i] += (target[i] - arm.curls[i]) * Math.min(1, dt * 14);
  const typing = arm.typing ? Math.max(0, Math.sin(G.elapsed * 22 + arm.side)) * 0.35 : 0;
  arm.fingers.forEach((segs, i) => {
    const cv = arm.curls[i + 1] + (i < 2 ? typing * (i === 0 ? 1 : 0.6) : 0);
    segs[0].rotation.x = cv * 0.95; segs[1].rotation.x = cv * 1.25; segs[2].rotation.x = cv * 0.85;
  });
  const tc = arm.curls[0];
  arm.thumbBase.rotation.y = -arm.side * (0.75 - tc * 0.35);
  arm.thumb[1].rotation.x = tc * 0.6; arm.thumb[2].rotation.x = tc * 0.7;
}
// inclinação do corpo: o engenheiro se aproxima quando o alvo está fora do alcance
function leanFor(base, baseQuat) {
  const b = camBasis(base, baseQuat), out = new THREE.Vector3();
  [rig.L, rig.R].forEach((arm) => {
    if (!arm) return;
    const S = shoulderOf(b, arm.side), d = _v.subVectors(arm.position, S), ex = d.length() - (ARM_A + ARM_B) * 0.92;
    if (ex > 0) out.addScaledVector(d.normalize(), ex);
  });
  out.multiplyScalar(0.6); if (out.length() > 0.22) out.setLength(0.22);
  return out;
}


// o rig é refeito sempre que o avatar do engenheiro é recriado
on("player:rebuilt", (spec) => buildRig(spec));

export { _q, _v, _v2, _v3, camBasis, handRest, leanFor, rig, updateArm, wristForGrip, wristForTip };
