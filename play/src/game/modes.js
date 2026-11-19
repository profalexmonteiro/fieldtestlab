import * as THREE from "three/webgpu";
import { G } from "../core/store.js";
import { hud, toast } from "../core/base.js";
import { canvas } from "../core/renderer.js";
import { screens } from "../ui/screens.js";
import { world } from "../world/world.js";
import { npc } from "../world/characters.js";
import { handRest, rig, wristForGrip, wristForTip } from "../rig/arms.js";
import { tablet } from "../rig/tablet.js";
import { bench } from "../world/benchProps.js";
import { ease, tween, wait } from "../core/tweens.js";
import { maxScore } from "../rules/score.js";
import { goMode, mode } from "./state.js";
import { emit, on } from "../core/events.js";

// ======================================================================
// Estado e modos de jogo
// ======================================================================
G.run = null;
G.benchView = "bench"; G.busy = false;
const SCREEN_MODES = { npc: () => [npc.bubble], tv: () => [world.tv], rru: () => [tablet.scr], desk: () => [world.desk], shop: () => [world.shop], rack: () => [world.rackScreen] };
// trocar de modo passa pela máquina de estados (game/state.js); os efeitos abaixo reagem ao evento
function setMode(m) { goMode(m); }
on("mode:changed", ({ to: m }) => {
  screens.forEach((s) => { s.active = false; s.hover = -1; });
  (SCREEN_MODES[m] ? SCREEN_MODES[m]() : []).forEach((s) => (s.active = true));
  if (m === "bench" && G.benchView === "notebook" && bench.notebook) bench.notebook.scr.active = true;
  tablet.group.visible = m === "rru";
  document.body.dataset.mode = m;
  npc.bubble.mesh.visible = m === "npc";
  canvas.style.cursor = "";
});
function setBenchView(v) {
  G.benchView = v;
  if (bench.notebook) { bench.notebook.scr.active = v === "notebook" && mode === "bench"; bench.notebook.scr.hover = -1; }
  emit("benchView:changed", v);
}
const FIRST_PERSON = { bench: 1, desk: 1, cabinet: 1, rru: 1, tv: 1, shop: 1, rack: 1, drive: 1 };
const RIG_MODES = { bench: 1, desk: 1, rru: 1 };

function addScore(part, pts) { G.run.score[part] += pts; if (pts > 0) toast("+" + pts + " pontos", "good"); hud(); }

function moveHand(h, to, dur, arc) {
  const from = h.position.clone(), a = arc === undefined ? 0.06 : arc;
  return tween(dur || 420, (k) => { const e = ease(k); h.position.lerpVectors(from, to, e); h.position.y += Math.sin(e * Math.PI) * a; });
}
// a mão leva um objeto; a palma fica sobre ele
function carry(h, obj, to, dur) {
  const from = obj.position.clone();
  h.pose = "grip";
  return tween(dur || 450, (k) => { const e = ease(k); obj.position.lerpVectors(from, to, e); obj.position.y += Math.sin(e * Math.PI) * 0.06; h.position.copy(wristForGrip(h, obj.position)); });
}
async function tap(h, pt) {
  h.pose = "point";
  const top = wristForTip(h, pt.clone().add(new THREE.Vector3(0, 0.045, 0)));
  await moveHand(h, top, 340, 0.04);
  const down = wristForTip(h, pt);
  await tween(110, (k) => h.position.lerpVectors(top, down, k));
  await tween(130, (k) => h.position.lerpVectors(down, top, k));
}
const restHands = (d) => { rig.L.pose = rig.R.pose = "relax"; return Promise.all([moveHand(rig.L, handRest("L"), d || 380), moveHand(rig.R, handRest("R"), d || 380)]); };
const sideHand = (x) => (x < world.benchX - 0.1 ? rig.L : rig.R);            // esquerda da bancada → mão esquerda
async function typeAnim(ms) { rig.L.typing = rig.R.typing = true; rig.L.pose = rig.R.pose = "type"; await wait(ms || 520); rig.L.typing = rig.R.typing = false; }
async function mouseClick() {
  const m = world.mouse, R = rig.R, base = world.deskInfo.mouse;
  R.pose = "mouse";
  await tween(160, (k) => { m.position.z = base.z - Math.sin(k * Math.PI) * 0.03; R.position.copy(handRest("R")).add(new THREE.Vector3(0, -Math.sin(k * Math.PI) * 0.008, m.position.z - base.z)); });
}


export { FIRST_PERSON, RIG_MODES, addScore, carry, handRest, maxScore, mode, mouseClick, moveHand, restHands, setBenchView, setMode, sideHand, tap, typeAnim };
