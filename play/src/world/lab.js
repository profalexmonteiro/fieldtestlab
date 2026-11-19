import * as THREE from "three/webgpu";
import { addCollider, box, canvasTex, cyl, label, mat, scene, sphere, wall } from "../core/renderer.js";
import { makeScreen } from "../ui/screens.js";
import { world } from "./world.js";
import { LAB, SITES } from "../net/network.js";

// ======================================================================
// Laboratório: TV de chamados, armário, bancada, desktop e provador
// ======================================================================
const stations = {};
(function buildLab() {
  const { minX, maxX, minZ, maxZ, h } = LAB;
  const wc = "#E9EDF3";
  const ft = canvasTex(256, 256);
  ft.x.fillStyle = "#cfd6e0"; ft.x.fillRect(0, 0, 256, 256);
  ft.x.strokeStyle = "#b9c2cf"; ft.x.lineWidth = 3; for (let i = 0; i <= 256; i += 64) { ft.x.beginPath(); ft.x.moveTo(i, 0); ft.x.lineTo(i, 256); ft.x.moveTo(0, i); ft.x.lineTo(256, i); ft.x.stroke(); }
  ft.t.wrapS = ft.t.wrapT = THREE.RepeatWrapping; ft.t.repeat.set(9, 8); ft.t.needsUpdate = true;
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(maxX - minX, maxZ - minZ), new THREE.MeshStandardMaterial({ map: ft.t, roughness: 0.9 }));
  floor.rotation.x = -Math.PI / 2; floor.position.set(0, 0.03, (minZ + maxZ) / 2); floor.receiveShadow = true; scene.add(floor);

  wall(minX, minZ, maxX, minZ, h, wc); wall(minX, minZ, minX, maxZ, h, wc); wall(maxX, minZ, maxX, maxZ, h, wc);
  world.front = [wall(minX, maxZ, -1.3, maxZ, h, wc), wall(1.3, maxZ, maxX, maxZ, h, wc)];
  world.front.push(box(2.6, h - 2.5, 0.3, wc, 0, 2.5, maxZ));
  world.front.push(box(maxX - minX + 0.1, 0.35, 0.34, "#FF6B00", 0, h - 0.5, maxZ));
  world.front.forEach((m) => { m.material = m.material.clone(); m.material.transparent = true; });
  const glass = new THREE.MeshStandardMaterial({ color: "#6FB7E0", transparent: true, opacity: 0.6, roughness: 0.1, metalness: 0.4 });
  world.doorL = box(1.3, 2.5, 0.12, "", -0.65, 0, maxZ + 0.05, null, { material: glass });
  world.doorR = box(1.3, 2.5, 0.12, "", 0.65, 0, maxZ + 0.05, null, { material: glass });
  world.doorOpen = 0;
  world.roof = box(maxX - minX + 0.8, 0.3, maxZ - minZ + 0.8, "#172A45", 0, h, (minZ + maxZ) / 2);
  world.sign = label("FieldTest Lab · NovaLink", { scale: 2.2 }); world.sign.position.set(0, h + 1.2, maxZ + 0.3); scene.add(world.sign);

  // TV de chamados (parede do fundo)
  const bx = -5, bz = minZ + 0.2;
  box(3.25, 1.75, 0.1, "#0A192F", bx, 1.07, bz);
  world.tv = makeScreen(1280, 660, 3.05, 1.57); world.tv.mesh.position.set(bx, 1.945, bz + 0.06); scene.add(world.tv.mesh);
  box(1.8, 0.5, 0.45, "#46566E", bx, 0, minZ + 0.5); addCollider(bx, minZ + 0.5, 1.9, 0.6);
  world.tvPos = new THREE.Vector3(bx, 1.945, bz + 0.06);
  stations.tv = { pos: new THREE.Vector3(bx, 0, minZ + 2.6), label: label("TV de chamados"), y: 3.2 };

  // armário de materiais
  const cx = maxX - 0.55, cz = -19;
  const cab = new THREE.Group(); cab.position.set(cx, 0, cz); scene.add(cab);
  box(0.06, 2.4, 3.2, "#9AA6B8", 0.42, 0, 0, cab); box(0.9, 0.06, 3.2, "#9AA6B8", 0, 2.34, 0, cab); box(0.9, 0.08, 3.2, "#9AA6B8", 0, 0, 0, cab);
  [-1.58, 1.58].forEach((z) => box(0.9, 2.4, 0.04, "#9AA6B8", 0, 0, z, cab));
  world.shelfY = [0.08, 0.63, 1.21, 1.79];
  [0.6, 1.18, 1.76].forEach((y) => box(0.8, 0.03, 3.1, "#E1E6EE", 0, y, 0, cab));
  const cabLight = new THREE.PointLight(0xfff6e5, 0, 4, 0); cabLight.position.set(-0.2, 2.1, 0); cab.add(cabLight);
  const mkDoor = (side) => {
    const pivot = new THREE.Group(); pivot.position.set(-0.47, 0.06, side * 1.6); cab.add(pivot);
    box(0.04, 2.26, 1.58, "#5F6E85", 0, 0, -side * 0.79, pivot); box(0.03, 0.32, 0.04, "#C9D1DD", -0.035, 1.0, -side * 1.45, pivot);
    return pivot;
  };
  world.cab = { group: cab, x: cx, z: cz, open: 0, doorR: mkDoor(1), doorL: mkDoor(-1), light: cabLight, items: [] };
  addCollider(cx, cz, 1.0, 3.3);
  stations.cabinet = { pos: new THREE.Vector3(cx - 1.6, 0, cz), label: label("Armário · materiais e EPI"), y: 3.0 };

  // bancada
  const tx = 0, tz = -16;
  box(3.4, 0.08, 1.4, "#DCE3EC", tx, 0.86, tz);
  box(2.9, 0.004, 1.05, "#24564a", tx, 0.94, tz + 0.05).castShadow = false;
  [[-1.6, -0.6], [1.6, -0.6], [-1.6, 0.6], [1.6, 0.6]].forEach(([x, z]) => box(0.08, 0.86, 0.08, "#46566E", tx + x, 0, tz + z));
  box(3.4, 0.05, 1.3, "#C9D1DD", tx, 0.25, tz);
  box(3.4, 0.9, 0.06, "#172A45", tx, 0.94, tz - 0.67);
  addCollider(tx, tz, 3.5, 1.5);
  stations.bench = { pos: new THREE.Vector3(tx, 0, tz + 1.4), label: label("Bancada de testes"), y: 2.6 };
  // atenuador RF programável (fixo na bancada, lado direito)
  const ag = new THREE.Group(); ag.position.set(tx + 1.15, 0.944, tz - 0.32); scene.add(ag);
  box(0.34, 0.14, 0.22, "#172A45", 0, 0, 0, ag);
  const knob = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.03, 16), mat("#C9D1DD")); knob.rotation.x = Math.PI / 2; knob.position.set(0.1, 0.07, 0.12); ag.add(knob);
  box(0.012, 0.03, 0.006, "#FF6B00", 0, 0.02, 0.016, knob).rotation.x = -Math.PI / 2;
  const ad = canvasTex(256, 96); const adm = new THREE.Mesh(new THREE.PlaneGeometry(0.14, 0.055), new THREE.MeshBasicMaterial({ map: ad.t })); adm.position.set(-0.06, 0.08, 0.111); ag.add(adm);
  const lab = label("Atenuador RF", { scale: 0.14 }); lab.position.set(0, 0.26, 0); ag.add(lab);
  world.atten = { knob, knobPos: new THREE.Vector3(tx + 1.25, 0.944 + 0.07, tz - 0.2),
    draw(db) { ad.x.fillStyle = "#05070c"; ad.x.fillRect(0, 0, 256, 96); ad.x.fillStyle = "#4fd194"; ad.x.font = "bold 56px Consolas, monospace"; ad.x.textAlign = "center"; ad.x.fillText(`${db} dB`, 128, 68); ad.t.needsUpdate = true; } };
  world.atten.draw(0);
  world.benchTop = 0.944; world.benchZ = tz; world.benchX = tx;

  // estação de relatório: desktop com monitor, gabinete, teclado e mouse
  const dx = minX + 0.55, dz = -14;
  box(0.85, 0.05, 1.7, "#C9D1DD", dx + 0.05, 0.72, dz);
  [[-0.3, -0.78], [-0.3, 0.78], [0.4, -0.78], [0.4, 0.78]].forEach(([x, z]) => box(0.05, 0.72, 0.05, "#46566E", dx + x, 0, dz + z));
  box(0.2, 0.42, 0.42, "#172A45", dx + 0.1, 0, dz - 0.55);                              // gabinete
  sphere(0.012, "#3bd17a", dx + 0.205, 0.36, dz - 0.45, null, { emissive: "#3bd17a", emissiveIntensity: 1 });
  cyl(0.04, 0.08, 0.1, "#46566E", dx - 0.3, 0.77, dz, null, 10); box(0.05, 0.14, 0.08, "#46566E", dx - 0.27, 0.8, dz);   // pé do monitor, atrás da tela
  box(0.05, 0.64, 1.06, "#0A192F", dx - 0.21, 0.86, dz);
  world.desk = makeScreen(1280, 768, 1.0, 0.6);
  world.desk.mesh.rotation.y = Math.PI / 2; world.desk.mesh.position.set(dx - 0.17, 1.18, dz); scene.add(world.desk.mesh);
  world.keyboard = box(0.16, 0.02, 0.46, "#2b3b52", dx + 0.36, 0.77, dz + 0.08);
  world.mouse = box(0.1, 0.03, 0.06, "#2b3b52", dx + 0.38, 0.77, dz - 0.36);
  box(0.5, 0.45, 0.5, "#2b3b52", dx + 1.05, 0, dz); box(0.5, 0.6, 0.08, "#2b3b52", dx + 1.3, 0.45, dz);   // cadeira
  addCollider(dx + 0.05, dz, 0.95, 1.8);
  world.deskInfo = { x: dx, z: dz, kb: new THREE.Vector3(dx + 0.36, 0.79, dz + 0.08), mouse: new THREE.Vector3(dx + 0.38, 0.79, dz - 0.36) };
  stations.desk = { pos: new THREE.Vector3(dx + 1.6, 0, dz), label: label("Desktop · relatórios"), y: 2.4 };

  // provador / loja de uniformes
  const ux = maxX - 0.5, uz = -10.5;
  box(0.8, 2.2, 1.6, "#FF6B00", ux, 0, uz); box(0.04, 2.0, 0.02, "#B54800", ux - 0.41, 0.1, uz);
  addCollider(ux, uz, 0.9, 1.7);
  box(0.06, 0.9, 1.42, "#0A192F", maxX - 0.18, 1.1, -12.6);
  world.shop = makeScreen(1100, 700, 1.32, 0.84);
  world.shop.mesh.rotation.y = -Math.PI / 2; world.shop.mesh.position.set(maxX - 0.235, 1.55, -12.6); scene.add(world.shop.mesh);
  stations.shop = { pos: new THREE.Vector3(ux - 1.5, 0, -11.5), label: label("Provador · loja"), y: 2.9 };

  cyl(0.25, 0.2, 0.5, "#B54800", minX + 0.6, 0, maxZ - 0.7); sphere(0.45, "#3f8a4f", minX + 0.6, 0.85, maxZ - 0.7);
})();
SITES.forEach((s) => {
  stations["ladder:" + s.id] = { pos: new THREE.Vector3(s.tower.x, 0, s.tower.z + 1.95), label: label("Escada · exige EPI"), y: 2.6 };
  stations["rack:" + s.id] = { pos: new THREE.Vector3(s.rack.mx + 0.2, 0, s.rack.mz + 1.25), label: null };
  if (s.ims) stations["ims:" + s.id] = { pos: new THREE.Vector3(s.ims.mx, 0, s.ims.mz + 1.25), label: null };
});
stations.car = { pos: new THREE.Vector3(), label: null };
Object.values(stations).forEach((s) => { if (!s.label) return; s.label.position.set(s.pos.x, s.y, s.pos.z); s.label.scale.multiplyScalar(0.75); scene.add(s.label); });

export { stations };
