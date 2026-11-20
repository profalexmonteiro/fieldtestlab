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

  // pickup de drive test (frente em +x): cabine dupla, caçamba com escada no rack e materiais de telecom
  const car = new THREE.Group(); scene.add(car);
  const glass = { roughness: 0.15, metalness: 0.35 };
  box(4.9, 0.5, 1.9, "#FF6B00", 0, 0.42, 0, car);                                 // carroceria baixa
  box(4.94, 0.1, 1.94, "#B54800", 0, 0.52, 0, car);                               // friso
  box(1.15, 0.36, 1.86, "#FF6B00", 1.85, 0.92, 0, car);                           // capô
  box(1.0, 0.16, 1.88, "#1b1f27", 2.38, 0.5, 0, car);                             // para-choque dianteiro
  box(0.08, 0.3, 1.2, "#2b3b52", 2.45, 0.86, 0, car);                             // grade
  box(1.75, 0.9, 1.86, "#F4F6F9", 0.4, 0.92, 0, car);                             // cabine
  box(1.6, 0.48, 1.9, "#6FB7E0", 0.42, 1.24, 0, car, glass);                      // vidros laterais
  const shield = box(0.06, 0.5, 1.7, "#6FB7E0", 1.28, 1.22, 0, car, glass);       // para-brisa inclinado
  shield.rotation.z = -0.45;
  box(1.8, 0.06, 1.9, "#e1e6ee", 0.4, 1.82, 0, car);                              // teto
  box(0.04, 0.42, 0.04, "#46566E", -0.2, 0.98, 0.96, car);                         // maçaneta/coluna
  // caçamba
  box(2.15, 0.08, 1.82, "#2b3b52", -1.45, 0.92, 0, car);                          // assoalho
  [0.91, -0.91].forEach((z) => box(2.15, 0.48, 0.08, "#FF6B00", -1.45, 0.92, z, car)); // laterais
  box(0.08, 0.48, 1.9, "#FF6B00", -2.5, 0.92, 0, car);                            // tampa traseira
  box(0.25, 0.16, 1.92, "#1b1f27", -2.45, 0.42, 0, car);                          // para-choque traseiro
  // rack (santo antônio) sobre a caçamba e o teto, com a escada de extensão
  [[-2.35, 0.86], [-2.35, -0.86], [-0.55, 0.86], [-0.55, -0.86]].forEach(([x, z]) => cyl(0.035, 0.035, 1.02, "#46566E", x, 1.0, z, car, 8));
  [-2.35, -0.55, 0.95].forEach((x) => box(0.07, 0.07, 1.84, "#46566E", x, 2.0, 0, car)); // travessas
  cyl(0.035, 0.035, 0.22, "#46566E", 0.95, 1.85, 0.86, car, 8); cyl(0.035, 0.035, 0.22, "#46566E", 0.95, 1.85, -0.86, car, 8);
  const ladder = new THREE.Group(); ladder.position.set(-0.75, 2.08, 0.42); car.add(ladder);
  [0.22, -0.22].forEach((z) => box(3.6, 0.07, 0.06, "#C9D1DD", 0, 0, z, ladder, { metalness: 0.6, roughness: 0.35 }));
  for (let x = -1.65; x <= 1.66; x += 0.3) box(0.05, 0.04, 0.46, "#9AA6B8", x, 0.015, 0, ladder, { metalness: 0.6, roughness: 0.35 });
  box(0.12, 0.09, 0.5, "#FF6B00", -1.85, -0.01, 0, ladder);                       // pés de borracha
  // materiais de telecom na caçamba
  const reel = new THREE.Group(); reel.position.set(-2.0, 1.32, -0.45); reel.rotation.x = Math.PI / 2; car.add(reel);
  [0.17, -0.17].forEach((y) => cyl(0.36, 0.36, 0.04, "#9a6100", 0, y - 0.02, 0, reel, 20));   // flanges da bobina
  cyl(0.27, 0.27, 0.32, "#1b1f27", 0, -0.16, 0, reel, 20);                                    // cabo enrolado
  cyl(0.08, 0.08, 0.42, "#7a4d00", 0, -0.21, 0, reel, 10);                                    // eixo
  box(0.6, 0.32, 0.42, "#2b2f36", -1.2, 1.0, -0.55, car);                         // maleta de equipamentos
  box(0.6, 0.04, 0.42, "#F2A900", -1.2, 1.32, -0.55, car);                        //   faixa amarela
  box(0.46, 0.26, 0.36, "#2b2f36", -1.2, 1.36, -0.55, car);                       // maleta empilhada
  box(0.5, 0.42, 0.36, "#9AA6B8", -1.0, 1.0, 0.42, car, { metalness: 0.4 });      // RRU deitada
  for (let i = 0; i < 6; i++) box(0.5, 0.36, 0.015, "#C9D1DD", -1.0, 1.03, 0.25 + i * 0.065, car);  // aletas
  box(1.15, 0.12, 0.32, "#F4F6F9", -1.9, 1.0, 0.45, car);                         // antena painel
  box(0.2, 0.1, 0.12, "#46566E", -1.25, 1.02, 0.45, car);                         //   conectores
  const coil = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.045, 8, 20), mat("#1b1f27"));  // jumper enrolado
  coil.rotation.x = Math.PI / 2; coil.position.set(-0.75, 1.0, -0.2); car.add(coil);
  [[-2.35, 0.7], [-2.35, 0.48]].forEach(([x, z]) => {                              // cones de sinalização
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.38, 12), mat("#FF6B00")); cone.position.set(x, 1.19, z); car.add(cone);
    box(0.24, 0.03, 0.24, "#1b1f27", x, 0.99, z, car);
  });
  // faróis, lanternas, giroflex e antena de drive test
  box(0.06, 0.16, 0.36, "#FFF6C2", 2.44, 0.95, 0.66, car, { emissive: "#FFF6C2", emissiveIntensity: 0.4 });
  box(0.06, 0.16, 0.36, "#FFF6C2", 2.44, 0.95, -0.66, car, { emissive: "#FFF6C2", emissiveIntensity: 0.4 });
  box(0.06, 0.22, 0.14, "#c63b3b", -2.55, 0.95, 0.84, car); box(0.06, 0.22, 0.14, "#c63b3b", -2.55, 0.95, -0.84, car);
  box(0.36, 0.1, 1.1, "#1b1f27", 0.4, 1.88, 0, car);                              // barra de luz
  sphere(0.07, "#FF6B00", 0.4, 2.02, 0.4, car, { emissive: "#FF6B00", emissiveIntensity: 0.6 });
  sphere(0.07, "#FF6B00", 0.4, 2.02, -0.4, car, { emissive: "#FF6B00", emissiveIntensity: 0.6 });
  cyl(0.025, 0.025, 0.7, "#46566E", 1.0, 1.88, -0.5, car, 6); sphere(0.05, "#F4F6F9", 1.0, 2.6, -0.5, car);   // antena de scanner
  const wheels = [], front = [];
  [[-1.6, 0.95], [1.55, 0.95], [-1.6, -0.95], [1.55, -0.95]].forEach(([x, z]) => {
    const pivot = new THREE.Group(); pivot.position.set(x, 0.42, z); car.add(pivot);
    const w = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.32, 36), mat("#1b1f27")); w.rotation.x = Math.PI / 2; w.castShadow = true; pivot.add(w);
    const tread = new THREE.Mesh(new THREE.TorusGeometry(0.36, 0.07, 12, 36), mat("#22262e")); tread.rotation.x = Math.PI / 2; w.add(tread);   // banda do pneu
    cyl(0.26, 0.26, 0.335, "#C9D1DD", 0, -0.1675, 0, w, 32);                                               // calota
    for (let i = 0; i < 5; i++) { const spoke = box(0.46, 0.345, 0.05, "#9AA6B8", 0, -0.1725, 0, w); spoke.rotation.y = (i / 5) * Math.PI; }   // raios
    wheels.push(w); if (x > 0) front.push(pivot);
  });
  car.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  addCollider(-10, 3, 5.0, 2.2);
  const cl = label("Pickup de drive test", { scale: 1 }); cl.position.set(0, 3.3, 0); car.add(cl);
  world.car = { g: car, x: -10, z: 3, h: 0.3, speed: 0, steer: 0, wheels, front, col: colliders[colliders.length - 1] };

  [[-18, -6], [-16, 8], [-22, 2], [18, 8], [20, -14], [-20, -18], [16, -22], [-14, -28], [24, 2], [6, 24], [-6, 26]].forEach(([x, z]) => {
    cyl(0.18, 0.25, 1.4, "#7a5235", x, 0, z, null, 16);
    // copa em três camadas, com leve variação de tom e de giro entre as árvores
    [[1.45, 1.5, 2.0, "#3f8a4f"], [1.15, 1.35, 2.75, "#468f55"], [0.8, 1.15, 3.4, "#4f9a5d"]].forEach(([r, h, y, color], i) => {
      const c = new THREE.Mesh(new THREE.ConeGeometry(r, h, 24, 2), mat(color));
      c.position.set(x, y, z); c.rotation.y = (x + z + i) * 0.7; c.castShadow = true; c.receiveShadow = true; scene.add(c);
    });
    addCollider(x, z, 0.8, 0.8);
  });
  addCollider(0, -40, 90, 2); addCollider(0, 30, 90, 2); addCollider(-40, 0, 2, 90); addCollider(40, 0, 2, 90);
})();
