import * as THREE from "three/webgpu";
import { G } from "./store.js";
import { clamp, toast } from "./base.js";
import { camera, collide, renderer, scene } from "./renderer.js";
import { updateSky } from "../world/sky.js";
import { world } from "../world/world.js";
import { LAB } from "../net/network.js";
import { npc, player } from "../world/characters.js";
import { _v3, camBasis, leanFor, rig, updateArm } from "../rig/arms.js";
import { tabletGrip } from "../rig/tablet.js";
import { bench } from "../world/benchProps.js";
import { tweens } from "./tweens.js";
import { FIRST_PERSON, RIG_MODES } from "../game/modes.js";
import { PITCH_MAX, PITCH_MIN, camDist, joy, keys, typing } from "./input.js";
import { refreshObjective, refreshPrompt } from "../ui/objective.js";
import { dialog, npcUpdate } from "../game/npc.js";
import { carBlocked, carFwd, updateCarCollider } from "../game/car.js";
import { mode, phase, setPhase } from "../game/state.js";

// ======================================================================
// Loop principal
// ======================================================================
const clock = new THREE.Clock();
const camPos = new THREE.Vector3(0, 6, 20), camLook = new THREE.Vector3();
const tmpCam = new THREE.Object3D();
G.inside = false; G.elapsed = 0; let caretT = 0; let caretT2 = 0;
function framed(pos, look, withLean) {
  if (!withLean) return [pos, look];
  tmpCam.position.copy(pos); tmpCam.lookAt(look);
  // Object3D.lookAt aponta +z; a câmera olha para -z, então giramos 180°
  tmpCam.rotateY(Math.PI);
  const target = leanFor(pos, tmpCam.quaternion);
  rig.lean.lerp(target, 0.12);
  return [pos.clone().add(rig.lean), look.clone().addScaledVector(rig.lean, 0.7)];
}

function update(dt) {
  G.elapsed += dt;
  let f = 0, sd = 0;
  if (mode === "free" && !typing()) {
    if (keys.KeyW || keys.ArrowUp) f += 1; if (keys.KeyS || keys.ArrowDown) f -= 1;
    if (keys.KeyA || keys.ArrowLeft) sd -= 1; if (keys.KeyD || keys.ArrowRight) sd += 1;
    if (joy.id !== null) { f -= joy.y; sd += joy.x; }
  }
  if (mode === "free" || mode === "climb") {
    if (keys.KeyQ) G.camYaw += dt * 1.8; if (keys.KeyR) G.camYaw -= dt * 1.8;
    if (keys.PageUp || keys.KeyZ) G.camPitch = Math.max(PITCH_MIN, G.camPitch - dt * 1.2);
    if (keys.PageDown || keys.KeyX) G.camPitch = Math.min(PITCH_MAX, G.camPitch + dt * 1.2);
  }
  if (player.y > 0 || player.vy > 0) { player.vy -= 20 * dt; player.y += player.vy * dt; if (player.y <= 0) { player.y = 0; player.vy = 0; } }
  const airborne = player.y > 0.001;
  const car = world.car;
  if (mode === "drive") {
    let th = 0, st = 0;
    if (keys.KeyW || keys.ArrowUp) th += 1; if (keys.KeyS || keys.ArrowDown) th -= 1;
    if (keys.KeyA || keys.ArrowLeft) st += 1; if (keys.KeyD || keys.ArrowRight) st -= 1;
    if (joy.id !== null) { th -= joy.y; st -= joy.x; }
    const braking = th !== 0 && Math.sign(th) !== Math.sign(car.speed) && Math.abs(car.speed) > 0.3;
    car.speed += th * (braking ? 16 : 6.5) * dt;
    if (!th) car.speed *= Math.pow(0.4, dt);
    car.speed = clamp(car.speed, -5, 17);
    car.steer += (st * 0.5 - car.steer) * Math.min(1, dt * 6);
    const nh = car.h + (car.speed * Math.tan(car.steer) / 2.8) * dt, f = carFwd(nh);
    const nx = car.x + f.x * car.speed * dt, nz = car.z + f.z * car.speed * dt;
    if (!carBlocked(nx, nz, nh)) { car.x = nx; car.z = nz; car.h = nh; }
    else if (Math.abs(car.speed) > 2) { if (G.elapsed - (car.lastHit || -9) > 2) { car.lastHit = G.elapsed; toast("Batida! Cuidado com os obstáculos.", "bad"); } car.speed = -car.speed * 0.25; }
    else car.speed = 0;
    car.wheels.forEach((w) => (w.rotation.y -= (car.speed * dt) / 0.38));
    car.front.forEach((fp) => (fp.rotation.y = car.steer));
    player.pos.set(car.x, 0, car.z);
    caretT2 += dt; if (caretT2 > 0.3) { caretT2 = 0; refreshObjective(); }
  }
  updateCarCollider();
  if (mode === "climb") {
    let c = 0; if (keys.KeyW || keys.ArrowUp) c += 1; if (keys.KeyS || keys.ArrowDown) c -= 1; if (joy.id !== null) c -= joy.y;
    const before = player.climbY;
    player.climbY = clamp(player.climbY + c * 1.7 * dt, 0, world.tower.climbMax);
    player.climbPhase += Math.abs(player.climbY - before) * 7;
    if (player.climbY >= world.tower.climbMax - 0.02 && !G.topNotified) { G.topNotified = true; toast("Topo da torre! Inspecione as 3 RRUs.", "good"); }
  }
  const len = Math.hypot(f, sd), moving = len > 0.1;
  if (moving) {
    f /= Math.max(1, len); sd /= Math.max(1, len);
    const sp = (keys.ShiftLeft || keys.ShiftRight ? 6.5 : 4) * dt;
    const mx = (-Math.sin(G.camYaw) * f + Math.cos(G.camYaw) * sd) * sp, mz = (-Math.cos(G.camYaw) * f - Math.sin(G.camYaw) * sd) * sp;
    // dentro de um obstáculo (por exemplo, ao descer de um veículo), o movimento fica livre até sair dele
    const stuck = collide(player.pos.x, player.pos.z);
    if (stuck || !collide(player.pos.x + mx, player.pos.z)) player.pos.x += mx;
    if (stuck || !collide(player.pos.x, player.pos.z + mz)) player.pos.z += mz;
    let d = Math.atan2(mx, mz) - player.rot; d = Math.atan2(Math.sin(d), Math.cos(d));
    player.rot += d * Math.min(1, dt * 12); player.walk += sp * 2.2;
  }
  const p = player.parts, sw = moving && !airborne ? Math.sin(player.walk) * 0.7 : 0;
  p.legL.rotation.x += ((airborne ? -0.6 : sw) - p.legL.rotation.x) * 0.3; p.legR.rotation.x += ((airborne ? 0.35 : -sw) - p.legR.rotation.x) * 0.3;
  p.armL.rotation.x += ((player.carrying ? -1.2 : airborne ? -2.6 : -sw * 0.8) - p.armL.rotation.x) * 0.3;
  p.armR.rotation.x += ((player.carrying ? -1.2 : airborne ? -2.6 : sw * 0.8) - p.armR.rotation.x) * 0.3;
  if (mode === "climb" || mode === "rru") {
    const c = Math.sin(player.climbPhase);
    p.armL.rotation.x = -2.75 + c * 0.35; p.armR.rotation.x = -2.75 - c * 0.35; p.legL.rotation.x = -0.45 + c * 0.4; p.legR.rotation.x = -0.45 - c * 0.4; player.rot = Math.PI;
  }
  player.model.visible = !FIRST_PERSON[mode];
  const climbing = mode === "climb" || mode === "rru";
  player.model.position.set(player.pos.x, climbing ? player.climbY : player.y + (moving && !airborne ? Math.abs(Math.sin(player.walk)) * 0.04 : 0), player.pos.z);
  player.model.rotation.y = player.rot;

  // portas, interior, armário, LEDs
  const dDoor = Math.hypot(player.pos.x, player.pos.z - LAB.maxZ);
  world.doorOpen += ((dDoor < 3.2 ? 1 : 0) - world.doorOpen) * Math.min(1, dt * 6);
  world.doorL.position.x = -0.65 - world.doorOpen * 1.2; world.doorR.position.x = 0.65 + world.doorOpen * 1.2;
  const nowInside = player.pos.x > LAB.minX && player.pos.x < LAB.maxX && player.pos.z > LAB.minZ && player.pos.z < LAB.maxZ;
  if (nowInside !== G.inside) {
    G.inside = nowInside; world.roof.visible = !G.inside; world.sign.visible = !G.inside;
    if (G.inside && phase === "enter") { setPhase("board"); refreshObjective(); toast("Bem-vindo ao laboratório!", "good"); }
  }
  world.doorL.material.opacity += ((G.inside ? 0.12 : 0.6) - world.doorL.material.opacity) * 0.15;
  world.front.forEach((m) => { m.material.opacity += ((G.inside ? 0.18 : 1) - m.material.opacity) * 0.15; const dw = m.material.opacity > 0.9; if (m.material.depthWrite !== dw) { m.material.depthWrite = dw; m.material.needsUpdate = true; } });
  const cab = world.cab;
  cab.open += ((mode === "cabinet" ? 1 : 0) - cab.open) * Math.min(1, dt * 5);
  cab.doorR.rotation.y = cab.open * 1.95; cab.doorL.rotation.y = -cab.open * 1.95; cab.light.intensity = cab.open * 2.5;
  world.leds.forEach((l, i) => { l.material.emissiveIntensity = Math.sin(G.elapsed * (2 + (i % 3)) + i * 1.7) > -0.2 ? 1.2 : 0.1; });
  updateSky(dt);
  world.beacons.forEach((b, i) => { b.material.emissiveIntensity = Math.sin(G.elapsed * 4 + i) > 0 ? 1.2 : 0.1; });

  npcUpdate(dt);

  // câmera por modo
  let desired, look, fov = 55, lean = false;
  const bx = world.benchX, z0 = world.benchZ, top = world.benchTop;
  if (mode === "bench" && G.benchView === "notebook" && bench.notebook) {
    const np = bench.notebook.g.position; desired = new THREE.Vector3(np.x, top + 0.44, np.z + 0.5); look = new THREE.Vector3(np.x, top + 0.13, np.z - 0.2); lean = true; fov = 60;
  } else if (mode === "bench") { desired = new THREE.Vector3(bx - 0.2, 1.64, z0 + 1.0); look = new THREE.Vector3(bx - 0.2, 0.84, z0 - 0.15); lean = true; fov = 66; }
  else if (mode === "desk") { const d = world.deskInfo; desired = new THREE.Vector3(d.x + 1.05, 1.22, d.z + 0.05); look = new THREE.Vector3(d.x - 0.17, 1.08, d.z + 0.05); lean = true; fov = 60; }
  else if (mode === "cabinet") { const d = Math.max(4.0, 1.75 / (Math.tan((camera.fov * Math.PI) / 360) * camera.aspect)); desired = new THREE.Vector3(cab.x - d, 1.05, cab.z); look = new THREE.Vector3(cab.x, 0.62, cab.z); }
  else if (mode === "tv") { desired = new THREE.Vector3(world.tvPos.x, 1.95, world.tvPos.z + 2.75); look = world.tvPos.clone(); }
  else if (mode === "shop") { desired = new THREE.Vector3(LAB.maxX - 1.75, 1.55, -12.6); look = new THREE.Vector3(LAB.maxX - 0.21, 1.52, -12.6); }
  else if (mode === "rack") { desired = new THREE.Vector3(world.rack.mx, 1.36, world.rack.mz + 1.1); look = new THREE.Vector3(world.rack.mx, 1.27, world.rack.mz); }
  else if (mode === "rru") { const t = world.tower; desired = new THREE.Vector3(t.x, player.climbY + 1.72, t.ladderZ + 0.4); look = new THREE.Vector3(t.x + 0.05, 11.75, t.z + 0.6); }
  else if (mode === "drive") {
    const f = carFwd(car.h);
    desired = new THREE.Vector3(car.x - f.x * 8.5, 3.6, car.z - f.z * 8.5); look = new THREE.Vector3(car.x + f.x * 3, 1.2, car.z + f.z * 3);
  } else if (mode === "npc") {
    const dir = _v3.subVectors(npc.pos, player.pos).setY(0).normalize(), side = new THREE.Vector3(-dir.z, 0, dir.x);
    desired = player.pos.clone().addScaledVector(dir, -0.6).addScaledVector(side, 1.15).setY(1.78);
    const b = camBasis(camera.position, camera.quaternion);
    look = npc.pos.clone().setY(1.65).addScaledVector(b.right, 0.5);
  } else {
    const dist = G.inside ? Math.min(camDist, 6.5) : camDist, headY = 1.5 + (mode === "climb" ? player.climbY : player.y * 0.6);
    const horiz = Math.cos(G.camPitch) * dist;
    desired = new THREE.Vector3(player.pos.x + Math.sin(G.camYaw) * horiz, Math.max(0.25, headY + Math.sin(G.camPitch) * dist), player.pos.z + Math.cos(G.camYaw) * horiz);
    look = new THREE.Vector3(player.pos.x, headY + Math.max(0, -G.camPitch) * 4.5, player.pos.z);
  }
  if (lean) [desired, look] = framed(desired, look, true); else rig.lean.set(0, 0, 0);
  const k = Math.min(1, dt * (mode === "free" || mode === "climb" || mode === "drive" ? 6 : 4.5));
  camPos.lerp(desired, k); camLook.lerp(look, k);
  camera.position.copy(camPos); camera.lookAt(camLook);
  if (Math.abs(camera.fov - fov) > 0.05) { camera.fov += (fov - camera.fov) * Math.min(1, dt * 5); camera.updateProjectionMatrix(); }
  camera.updateMatrixWorld(true);

  // braços em primeira pessoa
  rig.group.visible = !!RIG_MODES[mode];
  if (rig.group.visible) {
    if (mode === "rru") {
      const gr = tabletGrip(); rig.L.position.copy(gr.L); rig.R.position.copy(gr.R); rig.L.fingerDir = rig.R.fingerDir = gr.up; rig.L.pose = rig.R.pose = "hold";
    } else { rig.L.fingerDir = rig.R.fingerDir = null; }
    const b = camBasis(camera.position, camera.quaternion);
    updateArm(rig.L, b, dt); updateArm(rig.R, b, dt);
  }

  // marcador
  const tg = world.target, showMarker = tg && (mode === "free" || mode === "drive");
  marker.visible = ring.visible = !!showMarker;
  if (showMarker) {
    marker.position.set(tg.x, 2.2 + Math.sin(G.elapsed * 3) * 0.15, tg.z); marker.rotation.y = G.elapsed * 2;
    ring.position.set(tg.x, 0.05, tg.z); ring.scale.setScalar(1 + Math.sin(G.elapsed * 3) * 0.08);
  }
  for (let i = tweens.length - 1; i >= 0; i--) {
    const tw = tweens[i]; tw.t += dt * 1000;
    const kk = Math.min(1, tw.t / tw.dur); tw.update(kk);
    if (kk >= 1) { tweens.splice(i, 1); tw.res(); }
  }
  caretT += dt; if (dialog && dialog.page === "name" && caretT > 0.5) { caretT = 0; dialog.draw(); }
  refreshPrompt();
}

const marker = new THREE.Mesh(new THREE.OctahedronGeometry(0.28), new THREE.MeshStandardMaterial({ color: "#FF6B00", emissive: "#FF6B00", emissiveIntensity: 0.6 }));
scene.add(marker);
const ring = new THREE.Mesh(new THREE.RingGeometry(0.7, 0.85, 40), new THREE.MeshBasicMaterial({ color: "#FF6B00", transparent: true, opacity: 0.7, side: THREE.DoubleSide }));
ring.rotation.x = -Math.PI / 2; scene.add(ring);

function loop() { const dt = Math.min(0.05, clock.getDelta()); update(dt); renderer.render(scene, camera); }

export { camPos, loop };
