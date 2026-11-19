import * as THREE from "three/webgpu";
import { toast } from "../core/base.js";
import { collide, colliders } from "../core/renderer.js";
import { world } from "../world/world.js";
import { bestCell } from "../net/network.js";
import { stations } from "../world/lab.js";
import { player } from "../world/characters.js";
import { setMode } from "./modes.js";
import { registerMode, registerStation } from "./registry.js";

// ======================================================================
// Carro de drive test: entrar, dirigir e medir a melhor célula
// ======================================================================
function carFwd(h) { return new THREE.Vector3(Math.cos(h), 0, -Math.sin(h)); }
function carDoor() { const c = world.car; return new THREE.Vector3(c.x - Math.sin(c.h) * 1.7, 0, c.z - Math.cos(c.h) * 1.7); }
function updateCarCollider() {
  const c = world.car, L = 2.2, Wd = 1.0;
  const ex = Math.abs(Math.cos(c.h)) * L + Math.abs(Math.sin(c.h)) * Wd, ez = Math.abs(Math.sin(c.h)) * L + Math.abs(Math.cos(c.h)) * Wd;
  Object.assign(c.col, { minX: c.x - ex, maxX: c.x + ex, minZ: c.z - ez, maxZ: c.z + ez });
  c.g.position.set(c.x, 0, c.z); c.g.rotation.y = c.h;
  stations.car.pos.copy(carDoor());
}
function carBlocked(x, z, h) {
  const f = carFwd(h);
  for (const tt of [-1.7, 0, 1.7]) {
    const px = x + f.x * tt, pz = z + f.z * tt;
    for (const c of colliders) { if (c === world.car.col) continue; if (px > c.minX - 0.95 && px < c.maxX + 0.95 && pz > c.minZ - 0.95 && pz < c.maxZ + 0.95) return true; }
  }
  return false;
}
function driveText() {
  const c = world.car, b = bestCell(c.x, c.z);
  return `${Math.round(Math.abs(c.speed) * 3.6)} km/h · melhor célula: ${b.op} ${b.band} (${b.site.name}, PCI ${b.pci}) · RSRP ${b.rsrp} dBm`;
}
function enterCar() {
  if (player.carrying) { toast("Leve primeiro os materiais até a bancada.", "bad"); return; }
  world.car.speed = 0; setMode("drive");
  toast("Drive test: W/S acelera e freia, A/D vira, E para sair.", "good");
}
function exitCar() {
  const c = world.car; if (Math.abs(c.speed) > 1.5) { toast("Pare o carro antes de sair.", "bad"); return; }
  c.speed = 0;
  let door = carDoor();
  if (collide(door.x, door.z)) door = new THREE.Vector3(c.x + Math.sin(c.h) * 1.7, 0, c.z + Math.cos(c.h) * 1.7);
  player.pos.copy(door); player.rot = c.h + Math.PI / 2;
  setMode("free");
}


// estação e modo deste módulo (game/registry.js)
registerStation("car", { label: () => "Entrar no carro de drive test", open: enterCar });
registerMode("drive", {
  objective: driveText,
  prompt: () => ({ key: "drive", html: `<button id="pAct"><kbd>E</kbd>Sair do carro</button><button class="sec" disabled>W/S acelerar · A/D virar</button>` }),
  primary: () => exitCar(), escape: () => exitCar()
});

export { carBlocked, carFwd, exitCar, updateCarCollider };
