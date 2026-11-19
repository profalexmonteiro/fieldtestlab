import * as THREE from "three/webgpu";
import { clamp } from "../core/base.js";
import { box, camera } from "../core/renderer.js";
import { makeScreen } from "../ui/screens.js";
import { _q } from "./arms.js";
import { on } from "../core/events.js";

// ======================================================================
// Tablet nas mãos (armário e inspeção das RRUs)
// ======================================================================
const tablet = { group: new THREE.Group() };
camera.add(tablet.group); tablet.group.visible = false;
box(0.32, 0.012, 0.205, "#0A192F", 0, -0.006, 0, tablet.group).rotation.x = Math.PI / 2;
tablet.scr = makeScreen(1000, 625, 0.3, 0.1875);
tablet.scr.mesh.position.z = 0.0065; tablet.group.add(tablet.scr.mesh);
function placeTablet() {
  const f = clamp(camera.aspect / 1.6, 0.55, 1);
  tablet.group.position.set(0, -0.105, -0.5); tablet.group.rotation.x = -0.15; tablet.group.scale.setScalar(0.92 * f);
}
function tabletGrip() {                // pontos onde as mãos seguram o tablet (em coordenadas do mundo)
  tablet.group.updateMatrixWorld(true);
  return { L: tablet.group.localToWorld(new THREE.Vector3(-0.185, -0.045, -0.02)), R: tablet.group.localToWorld(new THREE.Vector3(0.185, -0.045, -0.02)),
    up: new THREE.Vector3(0, 1, 0).applyQuaternion(tablet.group.getWorldQuaternion(_q)).normalize() };
}


on("resize", () => placeTablet());

export { tablet, tabletGrip };
