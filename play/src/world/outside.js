import * as THREE from "three/webgpu";
import { addCollider, box, colliders, cyl, label, mat, scene, sphere } from "../core/renderer.js";
import { world } from "./world.js";
import { SITES } from "../net/network.js";
import { buildSite } from "./sites.js";

(function buildOutside() {
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(140, 140), mat("#8fb07a"));
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
  box(60, 0.02, 7, "#4a5566", 0, 0, 16);
  for (let x = -28; x < 30; x += 4) box(1.8, 0.03, 0.18, "#F4F6F9", x, 0, 16);
  box(3, 0.025, 15, "#d5d9df", 0, 0, 0.5);
  box(26, 0.022, 3, "#d5d9df", 0, 0, 11.5);

  SITES.forEach(buildSite);
  world.tower = SITES[0].tower; world.rack = SITES[0].rack; world.rackScreen = SITES[0].screen;

  // carro de drive test
  const car = new THREE.Group(); scene.add(car);
  box(4.2, 0.9, 1.9, "#FF6B00", 0, 0.35, 0, car); box(2.4, 0.75, 1.7, "#F4F6F9", -0.2, 1.25, 0, car);
  box(2.2, 0.55, 1.72, "#6FB7E0", -0.2, 1.33, 0, car, { roughness: 0.2, metalness: 0.3 });
  box(0.06, 0.18, 0.4, "#FFF6C2", 2.11, 0.75, 0.6, car); box(0.06, 0.18, 0.4, "#FFF6C2", 2.11, 0.75, -0.6, car);    // faróis
  box(0.06, 0.16, 0.36, "#c63b3b", -2.11, 0.8, 0.62, car); box(0.06, 0.16, 0.36, "#c63b3b", -2.11, 0.8, -0.62, car);  // lanternas
  const wheels = [], front = [];
  [[-1.4, 0.95], [1.4, 0.95], [-1.4, -0.95], [1.4, -0.95]].forEach(([x, z]) => {
    const pivot = new THREE.Group(); pivot.position.set(x, 0.38, z); car.add(pivot);
    const w = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.3, 16), mat("#1b1f27")); w.rotation.x = Math.PI / 2; w.castShadow = true; pivot.add(w);
    box(0.2, 0.05, 0.31, "#9AA6B8", 0, -0.025, 0, w);
    wheels.push(w); if (x > 0) front.push(pivot);
  });
  cyl(0.03, 0.03, 0.6, "#46566E", 0.4, 2.0, 0, car, 6); sphere(0.06, "#FF6B00", 0.4, 2.62, 0, car);
  car.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  addCollider(-10, 3, 4.6, 3);
  const cl = label("Carro de drive test", { scale: 1 }); cl.position.set(0, 3.2, 0); car.add(cl);
  world.car = { g: car, x: -10, z: 3, h: 0.3, speed: 0, steer: 0, wheels, front, col: colliders[colliders.length - 1] };

  [[-18, -6], [-16, 8], [-22, 2], [18, 8], [20, -14], [-20, -18], [16, -22], [-14, -28], [24, 2], [6, 24], [-6, 26]].forEach(([x, z]) => {
    cyl(0.18, 0.25, 1.4, "#7a5235", x, 0, z, null, 8);
    const c = new THREE.Mesh(new THREE.ConeGeometry(1.3, 2.8, 9), mat("#3f8a4f")); c.position.set(x, 2.6, z); c.castShadow = true; scene.add(c);
    addCollider(x, z, 0.8, 0.8);
  });
  addCollider(0, -40, 90, 2); addCollider(0, 30, 90, 2); addCollider(-40, 0, 2, 90); addCollider(40, 0, 2, 90);
})();
