import * as THREE from "three/webgpu";
import { box, canvasTex, label, mat, roundRect, scene } from "../core/renderer.js";
import { UI, dropScreen, makeScreen, setScreen } from "../ui/screens.js";
import { world } from "./world.js";
import { EQUIPMENT } from "../data/index.js";

// ======================================================================
// Itens da bancada (telefones, SIM, notebook, cabo USB)
// ======================================================================
const bench = { group: new THREE.Group(), phones: {}, extras: [], notebook: null, cable: null, plug: null, sims: {} };
scene.add(bench.group);

function makePhone(name, ref, tag) {
  const g = new THREE.Group();
  box(0.1, 0.012, 0.2, "#0A192F", 0, 0, 0, g);
  box(0.004, 0.006, 0.03, "#46566E", 0.051, 0.003, -0.02, g);                 // botão lateral
  box(0.003, 0.004, 0.028, "#9AA6B8", 0.0505, 0.004, -0.07, g);               // gaveta do SIM
  const scr = canvasTex(200, 400);
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(0.088, 0.176), new THREE.MeshBasicMaterial({ map: scr.t }));
  plane.rotation.x = -Math.PI / 2; plane.position.y = 0.0135; g.add(plane);
  const lb = label(tag || (ref ? "CDUT · " : "DUT · ") + name, { scale: 0.13, border: tag ? "#2f63c9" : ref ? "#15724a" : "#FF6B00" });
  lb.position.set(0, 0.07, -0.13); g.add(lb);
  const ph = { g, scr, name, ref, state: "off", lines: 0 };
  drawPhone(ph);
  return ph;
}
function drawPhone(ph, extra) {
  const { x, c, t } = ph.scr, W = c.width, H = c.height;
  x.fillStyle = "#05070c"; x.fillRect(0, 0, W, H); x.textAlign = "center"; x.textBaseline = "alphabetic";
  if (ph.state === "boot") {
    const gr = x.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, "#172A45"); gr.addColorStop(1, "#0A192F"); x.fillStyle = gr; x.fillRect(0, 0, W, H);
    x.fillStyle = "#FF6B00"; x.font = "bold 46px Arial"; x.fillText(ph.name, W / 2, 190);
    x.fillStyle = "#C9D6E8"; x.font = "20px Arial"; x.fillText(extra || "iniciando…", W / 2, 236);
  } else if (ph.state === "home") {
    const gr = x.createLinearGradient(0, 0, W, H); gr.addColorStop(0, "#2f63c9"); gr.addColorStop(1, "#0A192F"); x.fillStyle = gr; x.fillRect(0, 0, W, H);
    x.fillStyle = "#fff"; x.font = "bold 18px Arial"; x.textAlign = "left"; x.fillText("12:00", 14, 26); x.textAlign = "right"; x.fillText(extra || "5G ▂▄▆█", W - 12, 26);
    x.textAlign = "center"; x.font = "bold 40px Arial"; x.fillText("12:00", W / 2, 120);
    [["#FF6B00", "FT Log"], ["#15724a", "Tel"], ["#c63b3b", "SIM"], ["#9AA6B8", "Ajustes"]].forEach(([col, n], i) => { const ax = 30 + (i % 2) * 90, ay = 200 + Math.floor(i / 2) * 90; x.fillStyle = col; roundRect(x, ax, ay, 56, 56, 14); x.fill(); x.fillStyle = "#fff"; x.font = "14px Arial"; x.fillText(n, ax + 28, ay + 76); });
  } else if (ph.state === "custom" && ph.custom) {
    const cu = ph.custom, sos = cu.fx === "sos";
    x.fillStyle = sos ? "#3a0d10" : "#0f1e33"; x.fillRect(0, 0, W, H); x.fillStyle = sos ? "#c63b3b" : "#2f63c9"; x.fillRect(0, 0, W, 54);
    x.fillStyle = "#fff"; x.font = "bold 22px Arial"; x.fillText(cu.title, W / 2, 36);
    const icon = { profile: "⇄", settings: "⚙", data: "⇵", atten: "📉", airplane: "✈", remote: "📞", dial: "📞", reboot: "⟳", headset: "🎧", sos: "🚨" }[cu.fx] || "•";
    x.font = "64px Arial"; x.fillText(icon, W / 2, 150);
    x.font = "17px Arial"; x.fillStyle = "#C9D6E8";
    cu.lines.forEach((l, i) => x.fillText(l.slice(0, 26), W / 2, 220 + i * 30));
    if (!cu.noRec) { x.fillStyle = "#c63b3b"; x.font = "bold 15px Arial"; x.fillText("● REC", W / 2, H - 24); }
    if (cu.btn) { x.fillStyle = cu.btn[1]; x.beginPath(); x.arc(W / 2, H - 70, 32, 0, Math.PI * 2); x.fill(); x.fillStyle = "#fff"; x.font = "bold 15px Arial"; x.fillText(cu.btn[0], W / 2, H - 22); }
  } else if (ph.state === "app" || ph.state === "rec" || ph.state === "done") {
    x.fillStyle = "#0f1e33"; x.fillRect(0, 0, W, H); x.fillStyle = "#FF6B00"; x.fillRect(0, 0, W, 54);
    x.fillStyle = "#0A192F"; x.font = "bold 24px Arial"; x.fillText("FT Logger", W / 2, 36);
    x.fillStyle = "#C9D6E8"; x.font = "17px Arial"; x.fillText(ph.state === "app" ? "Pronto para coletar" : ph.state === "rec" ? "Coletando RRC / NAS / IMS" : "Coleta concluída", W / 2, 90);
    x.beginPath(); x.arc(W / 2, 180, 50, 0, Math.PI * 2); x.fillStyle = ph.state === "rec" ? "#c63b3b" : ph.state === "done" ? "#15724a" : "#46566E"; x.fill();
    x.fillStyle = "#fff"; x.font = "bold 26px Arial"; x.fillText(ph.state === "rec" ? "● REC" : ph.state === "done" ? "✓" : "INICIAR", W / 2, 190);
    x.font = "16px Arial"; x.fillStyle = "#9fb0c8"; x.fillText("Mensagens: " + ph.lines, W / 2, 270);
    x.fillText(extra || (ph.state === "rec" ? "USB: aguardando…" : ""), W / 2, 300);
  }
  t.needsUpdate = true;
}
function makeNotebook() {
  const g = new THREE.Group();
  box(0.44, 0.02, 0.3, "#9AA6B8", 0, 0, 0, g);
  const kbd = canvasTex(256, 96); kbd.x.fillStyle = "#2b3b52"; kbd.x.fillRect(0, 0, 256, 96); kbd.x.fillStyle = "#46566E";
  for (let r = 0; r < 4; r++) for (let c = 0; c < 14; c++) kbd.x.fillRect(4 + c * 18, 4 + r * 22, 15, 18);
  kbd.t.needsUpdate = true;
  const kp = new THREE.Mesh(new THREE.PlaneGeometry(0.38, 0.15), new THREE.MeshStandardMaterial({ map: kbd.t })); kp.rotation.x = -Math.PI / 2; kp.position.set(0, 0.0205, -0.02); g.add(kp);
  box(0.12, 0.002, 0.07, "#B8C2D1", 0, 0.02, 0.105, g);                         // touchpad
  box(0.012, 0.008, 0.02, "#0A192F", -0.222, 0.005, 0.05, g);                    // porta USB
  const lid = new THREE.Group(); lid.position.set(0, 0.02, -0.15); lid.rotation.x = -0.28; g.add(lid);
  box(0.44, 0.29, 0.015, "#9AA6B8", 0, 0, 0, lid);
  const scr = makeScreen(1024, 660, 0.41, 0.264);
  scr.mesh.position.set(0, 0.145, 0.009); lid.add(scr.mesh);
  const nb = { g, lid, scr, lines: [], title: "FT Log Analyzer", status: "ocioso" };
  drawLog(nb);
  return nb;
}
function drawLog(nb, status) {
  if (status) nb.status = status;
  setScreen(nb.scr, (s) => {
    const x = s.x, W = s.W;
    UI.bg(s, "#0A192F"); x.fillStyle = "#172A45"; x.fillRect(0, 0, W, 64);
    x.fillStyle = "#FF6B00"; x.font = "bold 34px Consolas, monospace"; x.textAlign = "left"; x.textBaseline = "alphabetic"; x.fillText(nb.title, 22, 44);
    x.fillStyle = /captur/i.test(nb.status) ? "#ff7b7b" : "#4fd194"; x.textAlign = "right"; x.fillText(nb.status, W - 22, 44);
    x.textAlign = "left"; x.font = "26px Consolas, monospace";
    nb.lines.slice(-16).forEach((l, i) => { x.fillStyle = l.c || "#C9D6E8"; x.fillText(l.t.slice(0, 64), 18, 104 + i * 34); });
  });
}
function makeSim() {
  const g = new THREE.Group();
  box(0.05, 0.003, 0.034, "#F4F6F9", 0, 0, 0, g); box(0.016, 0.004, 0.014, "#C9A15A", -0.01, 0, 0, g);
  return g;
}
const EXTRA_COLORS = { iperf: "#13294d", ims: "#2f63c9", remote: "#15724a", audio: "#0A192F", route: "#FF6B00", emerg: "#c63b3b", gps: "#46566E", spectrum: "#172A45", thermal: "#9a6100", battery: "#15724a", camera: "#0A192F", sims: "#C9A15A" };
function makeExtra(k) {
  if (k === "remote") {                     // o terminal remoto é outro smartphone, com tela própria
    const ph = makePhone("Remoto", false, "📞 Terminal remoto · smartphone");
    ph.g.scale.setScalar(1.4); ph.state = "home"; drawPhone(ph, "4G ▂▄▆█"); ph.g.userData.phone = ph;
    return ph.g;
  }
  const g = new THREE.Group();
  box(0.2, 0.12, 0.16, EXTRA_COLORS[k] || "#46566E", 0, 0, 0, g);
  const e = EQUIPMENT[k];
  const lb = label(e.icon + " " + e.name.split(" ")[0], { scale: 0.13 }); lb.position.set(0, 0.2, 0); g.add(lb);
  return g;
}
function clearBench() {
  if (bench.notebook) dropScreen(bench.notebook.scr);
  scene.remove(bench.group);
  bench.group = new THREE.Group(); scene.add(bench.group);
  bench.phones = {}; bench.extras = []; bench.extraByKey = {}; bench.notebook = null; bench.cable = null; bench.plug = null; bench.sims = {};
}
function cableCurve(ph) {
  const top = world.benchTop, nbg = bench.notebook.g;
  nbg.updateMatrixWorld(true);
  const a = nbg.localToWorld(new THREE.Vector3(-0.232, 0.009, 0.05));
  const b = ph.g.position.clone().add(new THREE.Vector3(0, 0.012, 0.145));
  return new THREE.CatmullRomCurve3([a, new THREE.Vector3(a.x - 0.1, top + 0.01, a.z + 0.05), new THREE.Vector3((a.x + b.x) / 2, top + 0.006, Math.max(a.z, b.z) + 0.2), new THREE.Vector3(b.x, top + 0.01, b.z + 0.14), b]);
}
function setCable(ph) {
  if (bench.cable) { bench.group.remove(bench.cable); bench.cable = null; }
  if (bench.plug) { bench.group.remove(bench.plug); bench.plug = null; }
  if (!ph) return;
  bench.cable = new THREE.Mesh(new THREE.TubeGeometry(cableCurve(ph), 48, 0.0045, 6, false), mat("#F4F6F9"));
  bench.group.add(bench.cable);
}

export { bench, cableCurve, clearBench, drawLog, drawPhone, makeExtra, makeNotebook, makePhone, makeSim, setCable };
