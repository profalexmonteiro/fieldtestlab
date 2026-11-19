import * as THREE from "three/webgpu";
import { addCollider, box, cyl, label, mat, scene } from "../core/renderer.js";
import { makeScreen } from "../ui/screens.js";
import { world } from "./world.js";
import { CORES } from "../data/index.js";
import { OP_COLORS, siteCfg } from "../net/network.js";

// Rack de núcleo de cada site, afastado da torre e ligado ao rack da estação por uma calha de fibra:
// gNodeB → IMS (VoNR) · eNodeB → EPC + IMS (VoLTE) · BTS 2G → BSC/MSC (voz CS e SRVCC). Especificação em data/cores.json.
const CORE = CORES.racks;
function buildIms(site, kx, kz) {
  const ix = site.x + 7.5, iz = site.z;
  box(3.8, 0.12, 2.4, "#b9c0ca", ix + 0.75, 0, iz + 0.2);                       // base de concreto
  const g = new THREE.Group(); g.position.set(ix, 0.12, iz); scene.add(g);
  box(1.2, 0.12, 1.0, "#9AA6B8", 0, 0, 0, g);
  box(1.04, 2.2, 0.05, "#2b3b52", 0, 0.12, -0.42, g);
  box(0.05, 2.2, 0.88, "#46566E", -0.52, 0.12, 0, g); box(0.05, 2.2, 0.88, "#46566E", 0.52, 0.12, 0, g);
  box(1.12, 0.07, 0.95, "#46566E", 0, 2.32, 0, g);
  const spec = CORE[site.kind];
  spec.units.forEach(([n, c], ui) => {
    const y = 0.26 + ui * 0.29;
    box(0.94, 0.22, 0.75, c, 0, y, 0, g); box(0.9, 0.15, 0.01, "#172A45", 0, y + 0.035, 0.38, g);
    for (let i = 0; i < 4; i++) {
      const on = i === 3 ? "#2fa8ff" : "#3bd17a";
      const l = new THREE.Mesh(new THREE.SphereGeometry(0.016, 8, 6), new THREE.MeshStandardMaterial({ color: on, emissive: on, emissiveIntensity: 1 }));
      l.position.set(-0.38 + i * 0.055, y + 0.11, 0.39); g.add(l); world.leds.push(l);
    }
    const lb = label(n, { scale: 0.24 }); lb.position.set(0.28, y + 0.11, 0.5); g.add(lb);
  });
  addCollider(ix, iz, 1.3, 1.1);
  const rl = label(`${spec.title} · ${site.name}`, { scale: 0.9, border: spec.border }); rl.position.set(ix, 3.0, iz); scene.add(rl);
  // calha de fibra no chão, passando por trás da torre, com subidas nas costas dos dois racks
  const cz = iz - 1.9, tray = "#7d8796";
  const rz = iz - 0.58, kr = kz - 0.58;
  box(0.14, 2.2, 0.1, tray, ix, 0, rz); box(0.14, 1.9, 0.1, tray, kx, 0, kr);
  box(0.3, 0.06, rz - cz, tray, ix, 0, (rz + cz) / 2);
  box(0.3, 0.06, kr - cz, tray, kx, 0, (kr + cz) / 2);
  box(ix - kx + 0.3, 0.06, 0.3, tray, (ix + kx) / 2, 0, cz);
  const P = (x, y, z) => new THREE.Vector3(x, y, z);
  [[-0.04, "#FF6B00"], [0.04, "#ffc21a"]].forEach(([o, c]) => {
    const pts = [P(ix + o, 2.15, rz + 0.07), P(ix + o, 0.09, rz + 0.07), P(ix + o, 0.09, cz + o), P(kx + o, 0.09, cz + o), P(kx + o, 0.09, kr + 0.07), P(kx + o, 1.85, kr + 0.07)];
    const path = new THREE.CurvePath();
    for (let i = 0; i < pts.length - 1; i++) path.add(new THREE.LineCurve3(pts[i], pts[i + 1]));
    scene.add(new THREE.Mesh(new THREE.TubeGeometry(path, 120, 0.022, 6, false), mat(c)));
  });
  const fl = label(spec.tray, { scale: 0.55 }); fl.position.set((ix + kx) / 2 + 2, 0.7, cz); scene.add(fl);
  // monitor do IMS (lado oposto à torre)
  const mx = ix + 1.55, mz = iz + 0.15;
  cyl(0.05, 0.08, 0.9, "#46566E", mx, 0.12, mz - 0.06, null, 8);
  box(0.78, 0.52, 0.05, "#0A192F", mx, 1.02, mz - 0.03);
  site.imsScreen = makeScreen(960, 620, 0.72, 0.465);
  site.imsScreen.mesh.position.set(mx, 1.28, mz + 0.012); scene.add(site.imsScreen.mesh);
  addCollider(mx, mz, 0.5, 0.4);
  site.ims = { x: ix, z: iz, mx, mz };
}
function refreshRruLabels(site) {
  const cfg = siteCfg(site);
  site.rruLabels = site.rruLabels.map((sp, i) => {
    const par = sp.parent, n = label(`RRU ${i + 1} · ${cfg[i][0]} ${cfg[i][1]}`, { scale: 0.42, border: OP_COLORS[cfg[i][0]] });
    n.position.copy(sp.position); par.remove(sp); par.add(n); return n;
  });
}


export { CORE, buildIms, refreshRruLabels };
