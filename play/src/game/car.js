import * as THREE from "three/webgpu";
import { toast } from "../core/base.js";
import { G } from "../core/store.js";
import { collide, colliders } from "../core/renderer.js";
import { world } from "../world/world.js";
import { bestCell } from "../net/network.js";
import { stations } from "../world/lab.js";
import { player } from "../world/characters.js";
import { setMode } from "./modes.js";
import { registerMode, registerStation } from "./registry.js";
import { phase } from "./state.js";
import { fieldStatus } from "./field.js";
import { measurePoint } from "../rules/field.js";
import { refreshObjective, refreshPrompt } from "../ui/objective.js";

// ======================================================================
// Pickup de drive test: entrar, dirigir e medir a melhor célula
// ======================================================================
function carFwd(h) { return new THREE.Vector3(Math.cos(h), 0, -Math.sin(h)); }
const HALF_LEN = 2.45, HALF_WID = 0.95;          // meia-medida da pickup (frente em +x local)
function carDoor() { const c = world.car; return new THREE.Vector3(c.x - Math.sin(c.h) * 1.9, 0, c.z - Math.cos(c.h) * 1.9); }
// Ponto livre para descer: lado do motorista, lado do passageiro, traseira, frente e diagonais,
// cada vez mais longe. O colisor da pickup é um retângulo alinhado aos eixos que cresce com a
// inclinação; descer a uma distância fixa deixava o personagem dentro dele, sem poder andar.
function exitSpot() {
  const c = world.car;
  const side = (s, d) => new THREE.Vector3(c.x - s * Math.sin(c.h) * d, 0, c.z - s * Math.cos(c.h) * d);
  const along = (s, d) => new THREE.Vector3(c.x + s * Math.cos(c.h) * d, 0, c.z - s * Math.sin(c.h) * d);
  for (let extra = 0; extra <= 3; extra += 0.25) {
    const spots = [side(1, HALF_WID + 1.0 + extra), side(-1, HALF_WID + 1.0 + extra), along(-1, HALF_LEN + 0.9 + extra), along(1, HALF_LEN + 0.9 + extra)];
    const free = spots.find((p) => !collide(p.x, p.z));
    if (free) return free;
  }
  return side(1, HALF_WID + 4);
}
function updateCarCollider() {
  const c = world.car, L = HALF_LEN, Wd = HALF_WID;
  const ex = Math.abs(Math.cos(c.h)) * L + Math.abs(Math.sin(c.h)) * Wd, ez = Math.abs(Math.sin(c.h)) * L + Math.abs(Math.cos(c.h)) * Wd;
  Object.assign(c.col, { minX: c.x - ex, maxX: c.x + ex, minZ: c.z - ez, maxZ: c.z + ez });
  c.g.position.set(c.x, 0, c.z); c.g.rotation.y = c.h;
  stations.car.pos.copy(carDoor());
}
function carBlocked(x, z, h) {
  const f = carFwd(h);
  for (const tt of [-2.0, 0, 2.0]) {
    const px = x + f.x * tt, pz = z + f.z * tt;
    for (const c of colliders) { if (c === world.car.col) continue; if (px > c.minX - 0.95 && px < c.maxX + 0.95 && pz > c.minZ - 0.95 && pz < c.maxZ + 0.95) return true; }
  }
  return false;
}
const drivePlan = () => phase === "bench" ? fieldStatus(G.run) : null;

function measureDrivePoint() {
  const status = drivePlan();
  if (!status?.next) return;
  const result = measurePoint(status.next, world.car, status.network, status.samples.at(-1));
  if (result.error) { toast(result.error, "bad"); return; }
  G.run.fieldSamples = [...status.samples, result];
  const complete = status.index + 1 === status.points.length;
  toast(result.label + " registrado." + (complete ? " Volte à bancada." : ""), "good");
  refreshObjective();
  refreshPrompt(true);
}

function driveText() {
  const c = world.car;
  const speed = Math.round(Math.abs(c.speed) * 3.6) + " km/h";
  const status = drivePlan();
  if (status?.next) {
    const point = status.next;
    const distance = Math.round(Math.hypot(c.x - point.x, c.z - point.z));
    const reading = measurePoint(point, c, status.network, status.samples.at(-1));
    const guidance = reading.error ? (distance > point.radius ? distance + " m até o ponto" : reading.error) :
      (reading.paired ? "Par na PCI " + reading.cells[0].pci + " · " + reading.cells.map(({ rsrp, sinr }) => rsrp + " dBm / " + sinr + " dB").join(" × ") :
        reading.cells.map(({ band, rsrp }) => band + " " + rsrp + " dBm").join(" · ")) + " · M para registrar";
    return speed + " · " + (status.index + 1) + "/" + status.points.length + " " + point.label + " · " + guidance;
  }
  if (status) return speed + " · Medições registradas. Saia da pickup e volte à bancada.";
  const b = bestCell(c.x, c.z);
  return speed + " · melhor célula: " + b.op + " " + b.band + " (" + b.site.name + ", PCI " + b.pci + ") · RSRP " + b.rsrp + " dBm";
}
function enterCar() {
  if (player.carrying) { toast("Leve primeiro os materiais até a bancada.", "bad"); return; }
  world.car.speed = 0; setMode("drive");
  toast("Drive test: W/S acelera e freia, A/D vira, E para sair.", "good");
}
function exitCar() {
  const c = world.car; if (Math.abs(c.speed) > 1.5) { toast("Pare a pickup antes de sair.", "bad"); return; }
  c.speed = 0;
  const spot = exitSpot();
  player.pos.copy(spot); player.y = 0; player.vy = 0;
  player.rot = Math.atan2(spot.x - c.x, spot.z - c.z);       // de costas para a pickup
  setMode("free");
}


// estação e modo deste módulo (game/registry.js)
registerStation("car", { label: () => "Entrar na pickup de drive test", open: enterCar });
registerMode("drive", {
  objective: driveText,
  target: () => {
    const point = drivePlan()?.next;
    return point ? new THREE.Vector3(point.x, 0, point.z) : null;
  },
  prompt: () => {
    const pending = Boolean(drivePlan()?.next);
    return {
      key: "drive:" + pending,
      html: '<button id="pAct"><kbd>E</kbd>Sair da pickup</button>' +
        (pending ? '<button class="sec" id="pMeasure"><kbd>M</kbd>Registrar ponto</button>' : '') +
        '<button class="sec" disabled>W/S acelerar · A/D virar</button>'
    };
  },
  measure: measureDrivePoint,
  primary: exitCar,
  escape: exitCar
});

export { carBlocked, carFwd, exitCar, updateCarCollider };
