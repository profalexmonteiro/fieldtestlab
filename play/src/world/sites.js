import * as THREE from "three/webgpu";
import { addCollider, box, cyl, label, mat, scene, sphere } from "../core/renderer.js";
import { makeScreen } from "../ui/screens.js";
import { world } from "./world.js";
import { NETWORK } from "../data/index.js";
import { buildIms, refreshRruLabels } from "./coreRacks.js";

function buildSite(site) {
  const tx = site.x, tz = site.z;
  box(2.4, 0.3, 2.4, "#9AA6B8", tx, 0, tz); addCollider(tx, tz, 2.4, 2.4);
  const h = site.kind === "BTS 2G" ? 12 : 14;
  for (let i = 0; i < 4; i++) cyl(0.12, 0.2, h, "#B8C2D1", tx + (i % 2 ? 0.6 : -0.6), 0.3, tz + (i < 2 ? 0.6 : -0.6), null, 8);
  for (let y = 2; y < h; y += 2) box(1.4, 0.08, 1.4, "#9AA6B8", tx, y, tz);
  for (let a = 0; a < 3; a++) { const pn = box(0.35, 1.3, 0.15, "#F4F6F9", tx + Math.sin(a * 2.1) * 0.9, h - 1.5, tz + Math.cos(a * 2.1) * 0.9); pn.rotation.y = a * 2.1; }
  world.beacons.push(sphere(0.22, "#FF3B30", tx, h + 0.7, tz, null, { emissive: "#ff2a00", emissiveIntensity: 1 }));
  const tl = label(`${site.name} · ${site.kind}`, { scale: 1.3 }); tl.position.set(tx, h + 2, tz); scene.add(tl);
  // escada com gaiola (exige EPI)
  const lz = tz + 0.78, top = h - 1.6;
  site.tower = { x: tx, z: tz, ladderZ: lz, climbMax: top - 1.8, site };
  [-0.22, 0.22].forEach((dx) => cyl(0.025, 0.025, top - 0.3, "#FFC21A", tx + dx, 0.3, lz, null, 6));
  for (let y = 0.6; y < top; y += 0.32) box(0.44, 0.03, 0.03, "#FFC21A", tx, y, lz).castShadow = false;
  for (let y = 2.4; y < top; y += 1.1) { const hoop = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.014, 6, 20, Math.PI), mat("#FFC21A")); hoop.rotation.x = Math.PI / 2; hoop.position.set(tx, y, lz); scene.add(hoop); }
  for (const a of [-0.35, 0, 0.35]) cyl(0.012, 0.012, top - 2.4, "#FFC21A", tx + a, 2.4, lz + Math.sqrt(0.16 - a * a), null, 4);
  // 3 RRUs no topo
  site.rruLabels = [];
  for (let a = 0; a < 3; a++) {
    const ang = a * 2.1, rx = tx + Math.sin(ang) * 0.6, rz = tz + Math.cos(ang) * 0.6;
    const rru = new THREE.Group(); rru.position.set(rx, h - 2.45, rz); rru.rotation.y = ang; scene.add(rru);
    box(0.36, 0.52, 0.2, "#5F6E85", 0, 0, 0, rru);
    for (let f = -0.14; f <= 0.141; f += 0.07) box(0.02, 0.48, 0.07, "#46566E", f, 0.02, -0.13, rru);
    const led = new THREE.Mesh(new THREE.SphereGeometry(0.022, 8, 6), new THREE.MeshStandardMaterial({ color: "#3bd17a", emissive: "#3bd17a", emissiveIntensity: 1 }));
    led.position.set(0.13, 0.46, 0.105); rru.add(led); world.leds.push(led);
    const jumper = cyl(0.014, 0.014, 0.75, "#0A192F", 0, 0.5, 0.18, rru, 6); jumper.rotation.x = 0.5;
    const lb = label("RRU", { scale: 0.42 }); lb.position.set(0, 0.85, 0.15); rru.add(lb); site.rruLabels.push(lb);
  }
  // rack e monitor de gerência
  const kx = tx - 3.4, kz = tz;
  const rack = new THREE.Group(); rack.position.set(kx, 0, kz); scene.add(rack);
  box(1.2, 0.15, 1.0, "#9AA6B8", 0, 0, 0, rack);
  box(1.04, 1.95, 0.05, "#2b3b52", 0, 0.15, -0.42, rack);
  box(0.05, 1.95, 0.88, "#46566E", -0.52, 0.15, 0, rack); box(0.05, 1.95, 0.88, "#46566E", 0.52, 0.15, 0, rack);
  box(1.12, 0.07, 0.95, "#46566E", 0, 2.1, 0, rack);
  const rdoor = new THREE.Group(); rdoor.position.set(0.52, 0.15, 0.44); rdoor.rotation.y = 1.95; rack.add(rdoor);
  box(1.02, 1.93, 0.04, "#46566E", -0.51, 0, 0, rdoor); box(0.04, 0.3, 0.05, "#C9D1DD", -0.95, 0.9, 0.03, rdoor);
  NETWORK.ranUnits[site.kind].forEach(([n, c], ui) => {
    const y = 0.4 + ui * 0.38;
    box(0.94, 0.28, 0.75, c, 0, y, 0, rack); box(0.9, 0.2, 0.01, "#172A45", 0, y + 0.04, 0.38, rack);
    for (let i = 0; i < 4; i++) {
      const l = new THREE.Mesh(new THREE.SphereGeometry(0.017, 8, 6), new THREE.MeshStandardMaterial({ color: i === 3 ? "#FF6B00" : "#3bd17a", emissive: i === 3 ? "#FF6B00" : "#3bd17a", emissiveIntensity: 1 }));
      l.position.set(-0.38 + i * 0.055, y + 0.14, 0.39); rack.add(l); world.leds.push(l);
    }
    const lb = label(n, { scale: 0.26 }); lb.position.set(0.3, y + 0.14, 0.5); rack.add(lb);
  });
  addCollider(kx, kz, 1.3, 1.1);
  const rl = label(`Rack · ${site.kind}`, { scale: 0.9 }); rl.position.set(kx, 2.75, kz); scene.add(rl);
  const mx = kx - 1.15, mz = kz + 0.15;
  cyl(0.05, 0.08, 1.05, "#46566E", mx, 0, mz, null, 8);
  box(0.78, 0.52, 0.05, "#0A192F", mx, 1.02, mz - 0.03);
  site.screen = makeScreen(960, 620, 0.72, 0.465);
  site.screen.mesh.position.set(mx, 1.28, mz + 0.012); scene.add(site.screen.mesh);
  addCollider(mx, mz, 0.5, 0.4);
  site.rack = { x: kx, z: kz, mx, mz };
  const fiber = new THREE.CatmullRomCurve3([new THREE.Vector3(kx + 0.3, 2.15, kz), new THREE.Vector3(kx + 1.4, 2.5, kz), new THREE.Vector3(tx - 0.75, 2.2, tz),
    new THREE.Vector3(tx - 0.68, h / 2, tz), new THREE.Vector3(tx - 0.66, h - 2.8, tz), new THREE.Vector3(tx - 0.35, h - 2.4, tz + 0.2)]);
  scene.add(new THREE.Mesh(new THREE.TubeGeometry(fiber, 80, 0.03, 6, false), mat("#FF6B00")));
  refreshRruLabels(site);
  buildIms(site, kx, kz);
}

export { buildSite };
