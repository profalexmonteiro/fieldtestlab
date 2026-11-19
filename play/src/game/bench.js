import * as THREE from "three/webgpu";
import { G } from "../core/store.js";
import { PTS, devName, esc, isRef, toast } from "../core/base.js";
import { box, mat } from "../core/renderer.js";
import { world } from "../world/world.js";
import { cellName, missingCells } from "../net/network.js";
import { stations } from "../world/lab.js";
import { player } from "../world/characters.js";
import { rig, wristForGrip, wristForTip } from "../rig/arms.js";
import { bench, cableCurve, clearBench, drawLog, drawPhone, makeExtra, makeNotebook, makePhone, makeSim, setCable } from "../world/benchProps.js";
import { ease, tween, wait } from "../core/tweens.js";
import { addScore, carry, handRest, moveHand, restHands, setBenchView, setMode, sideHand, tap, typeAnim } from "./modes.js";
import { refreshObjective, refreshPrompt } from "../ui/objective.js";
import { quizScreen } from "../screens/quiz.js";
import { BENCH_OPS } from "../data/index.js";
import { opsForScenario } from "../rules/benchOps.js";
import { mode, phase, setPhase } from "./state.js";
import { analysis } from "./analysis.js";
import { captureLines } from "../rules/capture.js";
import { fieldStatus } from "./field.js";
import { registerMode, registerStation } from "./registry.js";

// ======================================================================
// Bancada
// ======================================================================
function useBench() {
  if (phase === "return" && G.run.bench.packed) { toast("Os materiais estão na caixa: devolva ao armário.", "bad"); return; }
  if (phase !== "bench" && phase !== "return") { toast(phase === "report" ? "Os testes acabaram: agora é o relatório no desktop." : phase === "cabinet" ? "Primeiro pegue os materiais no armário." : "Receba um chamado com a Lia antes de usar a bancada.", "bad"); return; }
  player.pos.set(stations.bench.pos.x, 0, stations.bench.pos.z); player.rot = Math.PI;
  G.benchView = "bench"; setMode("bench");
  const below = new THREE.Vector3(0, -0.25, 0.15);
  rig.L.position.copy(handRest("L")).add(below); rig.R.position.copy(handRest("R")).add(below);
  restHands(450);
}
const currentScenario = () => G.run.ch.scenarios[G.run.bench.idx];
function benchAction() {
  if (!G.run) return null;
  const b = G.run.bench;
  if (phase === "return") return b.packed ? null : { label: "Recolher os materiais na caixa", fn: packItems };
  if (!b.placed) return { label: "Colocar os materiais na mesa", fn: placeItems };
  if (fieldStatus(G.run)?.next) return { label: "Sair para medir os pontos de campo", fn: () => setMode("free") };
  if (!b.configured) return { label: "Configurar o cenário no notebook", fn: configure };
  const s = currentScenario(); if (!s) return null;
  return [{ label: `Ligar o ${devName(s)} e inserir o SIM`, fn: powerOn }, { label: "Abrir o app FT Logger e iniciar a coleta", fn: startApp }, ...opsFor(s), { label: "Conectar o USB e capturar os logs", fn: capture }][b.sub];
}
function benchHint() {
  const a = benchAction(); if (!a) return "Bancada pronta.";
  const s = G.run.bench.configured && currentScenario();
  return a.label + (s ? ` · Cenário: ${s.label}` : "");
}
async function doBenchAction() {
  const a = benchAction(); if (!a || G.busy || mode !== "bench") return;
  G.busy = true; refreshPrompt(true);
  try { await a.fn(); } finally { G.busy = false; refreshObjective(); refreshPrompt(true); }
}

// fim dos testes: cada mão devolve à caixa o que está do seu lado; o notebook é fechado e vai com as duas mãos
async function packItems() {
  const top = world.benchTop, z0 = world.benchZ, bx = world.benchX, L = rig.L, R = rig.R;
  const crate = new THREE.Vector3(bx - 0.15, top + 0.04, z0 + 0.62);
  setCable(null);
  const loose = [...Object.values(bench.phones).map((p) => p.g), ...Object.values(bench.sims).filter(Boolean), ...bench.extras].filter((o) => o.parent === bench.group);
  for (const obj of loose) {
    const h = sideHand(obj.position.x);
    h.pose = "grip"; await moveHand(h, wristForGrip(h, obj.position), 260, 0.03);
    await carry(h, obj, crate.clone().add(new THREE.Vector3(h === L ? -0.25 : 0.25, 0, 0)), 420);
    bench.group.remove(obj); h.pose = "relax";
  }
  const nb = bench.notebook;
  if (nb) {
    drawLog(nb, "desligando"); nb.g.updateMatrixWorld(true);
    const edge = new THREE.Vector3(); R.pose = "pinch";
    await moveHand(R, wristForTip(R, nb.lid.localToWorld(edge.set(0.1, 0.29, 0.01))), 320, 0.03);
    const c0 = nb.lid.rotation.x;
    await tween(650, (k) => { nb.lid.rotation.x = c0 + (Math.PI / 2 - 0.02 - c0) * ease(k); nb.lid.updateMatrixWorld(true); R.position.copy(wristForTip(R, nb.lid.localToWorld(edge.set(0.1, 0.29, 0.01)))); });
    const gripL = () => wristForGrip(L, nb.g.position.clone().add(new THREE.Vector3(-0.22, 0.02, 0.05)));
    const gripR = () => wristForGrip(R, nb.g.position.clone().add(new THREE.Vector3(0.22, 0.02, 0.05)));
    L.pose = R.pose = "grip";
    await Promise.all([moveHand(L, gripL(), 360), moveHand(R, gripR(), 360)]);
    const from = nb.g.position.clone();
    await tween(750, (k) => { const e = ease(k); nb.g.position.lerpVectors(from, crate, e); nb.g.position.y += Math.sin(e * Math.PI) * 0.08; L.position.copy(gripL()); R.position.copy(gripR()); });
  }
  await restHands();
  clearBench();
  player.carrying = true; player.parts.crate.visible = true; G.run.bench.packed = true;
  toast("Materiais na caixa. Devolva ao armário.", "good");
  setMode("free");
}

async function placeItems() {
  clearBench();
  player.carrying = false; player.parts.crate.visible = false;
  const top = world.benchTop, z0 = world.benchZ, bx = world.benchX, L = rig.L, R = rig.R;
  const below = new THREE.Vector3(bx - 0.15, top + 0.04, z0 + 0.62);
  // 1) o notebook vem com as duas mãos e a mão direita abre a tampa
  const nb = makeNotebook(); bench.notebook = nb;
  nb.g.scale.setScalar(1.25); nb.lid.rotation.x = Math.PI / 2 - 0.02;
  nb.g.position.copy(below); bench.group.add(nb.g); drawLog(nb, "desligado");
  const nbTo = new THREE.Vector3(bx + 0.45, top, z0);
  const gripL = () => wristForGrip(L, nb.g.position.clone().add(new THREE.Vector3(-0.22, 0.02, 0.05)));
  const gripR = () => wristForGrip(R, nb.g.position.clone().add(new THREE.Vector3(0.22, 0.02, 0.05)));
  L.pose = R.pose = "grip";
  await Promise.all([moveHand(L, gripL(), 380), moveHand(R, gripR(), 380)]);
  const from = nb.g.position.clone();
  await tween(850, (k) => { const e = ease(k); nb.g.position.lerpVectors(from, nbTo, e); nb.g.position.y += Math.sin(e * Math.PI) * 0.08; L.position.copy(gripL()); R.position.copy(gripR()); });
  L.pose = "relax"; moveHand(L, handRest("L"), 380);
  const edge = new THREE.Vector3();
  nb.g.updateMatrixWorld(true);
  R.pose = "pinch";
  await moveHand(R, wristForTip(R, nb.lid.localToWorld(edge.set(0.1, 0.29, 0.01))), 320, 0.03);
  const c0 = nb.lid.rotation.x;
  await tween(750, (k) => { nb.lid.rotation.x = c0 + (-0.28 - c0) * ease(k); nb.lid.updateMatrixWorld(true); R.position.copy(wristForTip(R, nb.lid.localToWorld(edge.set(0.1, 0.29, 0.01)))); });
  drawLog(nb, "aguardando configuração");
  // 2) cada mão leva o que fica do seu lado da bancada
  const devs = [];
  G.run.ch.scenarios.forEach((s) => { if (!devs.find((d) => d.name === devName(s))) devs.push({ name: devName(s), ref: isRef(s) }); });
  const jobs = [];
  devs.forEach((d, i) => {
    const ph = makePhone(d.name, d.ref); ph.g.scale.setScalar(1.4); bench.phones[d.name] = ph;
    jobs.push([ph.g, new THREE.Vector3(bx - 0.95 + i * 0.42, top, z0 + 0.02)]);
    const sim = makeSim(); sim.scale.setScalar(1.4); bench.sims[d.name] = sim;
    jobs.push([sim, new THREE.Vector3(bx - 0.95 + i * 0.42, top, z0 + 0.4)]);
  });
  let back = 0;
  G.run.eq.selected.filter((k) => !["modemlog", "cdut", "sims"].includes(k)).forEach((k) => {
    const ex = makeExtra(k); bench.extras.push(ex); bench.extraByKey = bench.extraByKey || {}; bench.extraByKey[k] = ex;
    // o smartphone remoto fica na fileira da frente, ao lado dos aparelhos em teste; os demais itens vão para o fundo
    jobs.push([ex, k === "remote" ? new THREE.Vector3(bx - 0.95 + devs.length * 0.42 - 0.03, top, z0 + 0.02) : new THREE.Vector3(bx - 1.3 + back++ * 0.32, top, z0 - 0.42)]);
  });
  for (const [obj, to] of jobs) {
    const h = sideHand(to.x);
    obj.position.copy(below).add(new THREE.Vector3(h === L ? -0.3 : 0.3, 0, 0)); bench.group.add(obj);
    await moveHand(h, wristForGrip(h, obj.position), 220, 0.02);
    await carry(h, obj, to, 520);
    h.pose = "relax";
  }
  await restHands();
  G.run.bench.placed = true;
  toast("Bancada montada", "good");
}

async function configure() {
  const g = G.run.ch.game, nb = bench.notebook, np = nb.g.position, top = world.benchTop;
  setBenchView("notebook");
  await wait(450);
  const key = (h, dx) => wristForTip(h, new THREE.Vector3(np.x + dx, top + 0.03, np.z - 0.01));
  rig.L.pose = rig.R.pose = "type";
  await Promise.all([moveHand(rig.L, key(rig.L, -0.1), 480), moveHand(rig.R, key(rig.R, 0.1), 480)]);
  for (let i = 0; i < g.setup.length; i++) {
    const q = g.setup[i];
    await quizScreen(nb.scr, q, { title: "FT Lab · Configuração do cenário", right: `${i + 1}/${g.setup.length}` },
      (frac) => { addScore("setup", Math.round(PTS.choice * frac)); G.run.setupLog[i] = q.options[0]; }, () => typeAnim(520));
  }
  nb.lines = [{ t: "> Cenário configurado:", c: "#FFC59A" }, ...G.run.setupLog.map((l) => ({ t: "  " + l }))];
  drawLog(nb, "pronto");
  setBenchView("bench");
  await restHands(450);
  G.run.bench.configured = true;
}

async function powerOn() {
  const s = currentScenario(), ph = bench.phones[devName(s)], sim = bench.sims[devName(s)], h = sideHand(ph.g.position.x);
  if (sim && sim.parent) {
    h.pose = "pinch";
    await moveHand(h, wristForGrip(h, sim.position), 380);                       // pega o SIM
    const slot = ph.g.position.clone().add(new THREE.Vector3(0.12, 0.012, -0.098));
    await carry(h, sim, slot, 650);                                              // leva até a gaveta lateral
    h.pose = "point";
    const sx = sim.position.x;
    await tween(340, (k) => { sim.position.x = sx - 0.05 * ease(k); h.position.copy(wristForTip(h, sim.position.clone().add(new THREE.Vector3(0.03, 0.004, 0)))); });
    bench.group.remove(sim); bench.sims[devName(s)] = null;
    toast("SIM inserido no " + devName(s));
  }
  const btn = ph.g.position.clone().add(new THREE.Vector3(0.075, 0.012, -0.028));   // botão lateral
  h.pose = "point";
  await moveHand(h, wristForTip(h, btn.clone().add(new THREE.Vector3(0.03, 0, 0))), 300, 0.02);
  const p0 = h.position.clone();
  await tween(240, (k) => { h.position.copy(p0).add(new THREE.Vector3(-0.022 * Math.sin(k * Math.PI), 0, 0)); });
  ph.state = "boot"; drawPhone(ph, "iniciando…");
  h.pose = "relax"; await moveHand(h, handRest(h === rig.L ? "L" : "R"), 380);
  await wait(450); drawPhone(ph, "registrando na rede…"); await wait(700);
  ph.state = "home"; drawPhone(ph, (s.rat === "LTE" ? "4G" : "5G") + " ▂▄▆█"); await wait(250);
  G.run.bench.sub++;
}
async function startApp() {
  const s = currentScenario(), ph = bench.phones[devName(s)], h = sideHand(ph.g.position.x);
  const scr = (u, v) => ph.g.position.clone().add(new THREE.Vector3((u - 0.5) * 0.088 * 1.4, 0.02, (v - 0.5) * 0.176 * 1.4));
  await tap(h, scr(58 / 200, 228 / 400));                 // ícone FT Log
  ph.state = "app"; ph.lines = 0; drawPhone(ph); await wait(450);
  await tap(h, scr(0.5, 180 / 400));                      // INICIAR
  ph.state = "rec"; drawPhone(ph);
  h.pose = "relax"; await moveHand(h, handRest(h === rig.L ? "L" : "R"), 380);
  G.run.bench.sub++;
}
// o cabo sai do notebook (mão direita) e é entregue à mão esquerda, que conecta no telefone
async function plugCable(ph) {
  setCable(null);
  const curve = cableCurve(ph), geo = new THREE.TubeGeometry(curve, 48, 0.0045, 6, false), total = geo.index.count;
  geo.setDrawRange(0, 0);
  bench.cable = new THREE.Mesh(geo, mat("#F4F6F9")); bench.group.add(bench.cable);
  const plug = box(0.012, 0.01, 0.026, "#C9D1DD", 0, 0, 0, bench.group); plug.position.copy(curve.getPoint(0)); bench.plug = plug;
  const R = rig.R, L = rig.L, far = sideHand(ph.g.position.x);
  R.pose = "pinch";
  await moveHand(R, wristForGrip(R, curve.getPoint(0)), 380, 0.05);
  const handoff = far === L ? 0.5 : 1;
  if (far === L) { L.pose = "pinch"; moveHand(L, wristForGrip(L, curve.getPoint(0.5)), 700, 0.04); }
  await tween(800, (k) => { const t = k * handoff; geo.setDrawRange(0, Math.floor((total * t) / 3) * 3); plug.position.copy(curve.getPoint(t)); R.position.copy(wristForGrip(R, plug.position)); });
  if (far === L) {
    R.pose = "relax"; moveHand(R, handRest("R"), 420);
    await tween(700, (k) => { const t = 0.5 + k * 0.5; geo.setDrawRange(0, Math.floor((total * t) / 3) * 3); plug.position.copy(curve.getPoint(t)); L.position.copy(wristForGrip(L, plug.position)); });
  }
  geo.setDrawRange(0, total); plug.position.copy(curve.getPoint(1));
  far.pose = "relax"; await moveHand(far, handRest(far === L ? "L" : "R"), 380);
}
// passos específicos de cada desafio, entre iniciar a coleta e capturar o log (data/benchOps.json)
function opsFor(s) {
  return opsForScenario(BENCH_OPS, G.run.ch.id, s.label).map((o) => ({ label: o.label, fn: () => phoneOp(o.title, o.lines, o.fx) }));
}
async function phoneOp(title, lines, fx) {
  const s = currentScenario(), ph = bench.phones[devName(s)], h = sideHand(ph.g.position.x);
  const scr = (u, v) => ph.g.position.clone().add(new THREE.Vector3((u - 0.5) * 0.088 * 1.4, 0.02, (v - 0.5) * 0.176 * 1.4));
  const show = (n) => { ph.custom = { title, lines: lines.slice(0, n), fx }; ph.state = "custom"; drawPhone(ph); };
  if (fx === "atten") { show(1); await turnAttenuator(); show(2); await wait(400); }
  else {
    if (fx === "reboot") { const btn = ph.g.position.clone().add(new THREE.Vector3(0.075, 0.012, -0.028)); h.pose = "point"; await moveHand(h, wristForTip(h, btn.clone().add(new THREE.Vector3(0.03, 0, 0))), 300, 0.02); }
    else await tap(h, scr(0.5, 0.45));
    for (let i = 1; i <= lines.length; i++) {
      show(i);
      if ((fx === "remote" || fx === "dial") && i === 1) await ringRemote(fx === "remote");
      else if (fx === "headset" && i === 1) await liftHeadset();
      else await wait(520);
      if (fx === "airplane" && i < lines.length) await tap(h, scr(0.5, 0.45));
    }
    h.pose = "relax"; await moveHand(h, handRest(h === rig.L ? "L" : "R"), 360);
  }
  ph.state = "rec"; drawPhone(ph, title + " ✓");
  G.run.bench.sub++;
}
async function turnAttenuator() {
  const a = world.atten, R = rig.R; R.pose = "pinch";
  await moveHand(R, wristForGrip(R, a.knobPos), 420, 0.05);
  const r0 = a.knob.rotation.z;
  await tween(1300, (k) => { a.knob.rotation.z = r0 - k * 4.2; a.draw(Math.round(k * 30)); });
  R.pose = "relax"; await moveHand(R, handRest("R"), 380);
  setTimeout(() => { a.knob.rotation.z = r0; a.draw(0); }, 2500);
}
// chamada entre o DUT e o smartphone remoto: incoming = o remoto liga para o DUT (MT); senão o DUT liga para o remoto (MO)
async function ringRemote(incoming) {
  const g = bench.extraByKey && bench.extraByKey.remote;
  if (!g) { await wait(600); return; }
  const rp = g.userData.phone, dut = bench.phones[devName(currentScenario())];
  const hR = sideHand(g.position.x), hD = sideHand(dut.g.position.x);
  const at = (obj, u, v) => obj.position.clone().add(new THREE.Vector3((u - 0.5) * 0.088 * 1.4, 0.02, (v - 0.5) * 0.176 * 1.4));
  const show = (title, lines, btn) => { rp.custom = { title, lines, fx: "remote", noRec: true, btn }; rp.state = "custom"; drawPhone(rp); };
  const shake = (obj, ms) => { const x0 = obj.position.x; return tween(ms, (k) => { obj.position.x = x0 + Math.sin(k * 60) * 0.006; }).then(() => { obj.position.x = x0; }); };
  if (incoming) {
    show("Discador", ["Ligar para o DUT", dut.name], ["Ligar", "#15724a"]);
    await tap(hR, at(g, 0.5, 0.86));
    show("Chamando…", ["Para: DUT " + dut.name, "Aguardando atender"], ["Encerrar", "#c63b3b"]);
    await shake(dut.g, 900);
    await tap(hD, dut.g.position.clone().add(new THREE.Vector3(0, 0.02, 0.05)));
  } else {
    show("Chamada recebida", ["De: DUT " + dut.name, "Toque para atender"], ["Atender", "#15724a"]);
    await shake(g, 1100);
    await tap(hR, at(g, 0.5, 0.86));
  }
  show("Em chamada", ["Com: DUT " + dut.name, incoming ? "Chamada MT" : "Chamada MO", "Áudio OK"], ["Encerrar", "#c63b3b"]);
  if (hR !== hD) { hR.pose = "relax"; await moveHand(hR, handRest(hR === rig.L ? "L" : "R"), 320); }
  setTimeout(() => { rp.state = "home"; drawPhone(rp, "4G ▂▄▆█"); }, 3500);
}
async function liftHeadset() {
  const g = bench.extraByKey && bench.extraByKey.audio;
  if (!g) { await wait(600); return; }
  const y0 = g.position.y, h = sideHand(g.position.x);
  h.pose = "grip"; await moveHand(h, wristForGrip(h, g.position), 360);
  await tween(500, (k) => { g.position.y = y0 + Math.sin(k * Math.PI) * 0.18; h.position.copy(wristForGrip(h, g.position)); });
  g.position.y = y0;
}

async function capture() {
  const s = currentScenario(), ph = bench.phones[devName(s)], nb = bench.notebook;
  const miss = missingCells(G.run.ch);
  if (miss.length) {
    nb.lines.push({ t: `> Sem célula no ar: ${miss.map(cellName).join(", ")}`, c: "#ff7b7b" }, { t: "> Configure as RRUs no rack de um site e volte.", c: "#FFC59A" });
    drawLog(nb, "sem cobertura"); ph.custom = { title: "Sem serviço", lines: miss.map(cellName), fx: "sos" }; ph.state = "custom"; drawPhone(ph);
    toast(`Sem cobertura de ${miss.map(cellName).join(", ")}. Configure no monitor do rack de um site (lá fora).`, "bad");
    return;
  }
  const field = fieldStatus(G.run);
  if (field?.next) {
    toast("Registre " + field.next.label + " no carro antes de capturar.", "bad");
    return;
  }
  await plugCable(ph);
  nb.title = "FT Log Analyzer · " + devName(s);
  nb.lines = [{ t: `> USB conectado: ${s.device}`, c: "#4fd194" }];
  drawLog(nb, "capturando"); drawPhone(ph, "USB: transmitindo");
  await wait(400);
  for (const line of captureLines(s)) {
    nb.lines.push(line);
    ph.lines += 3 + Math.floor(Math.random() * 9); drawPhone(ph, "USB: transmitindo");
    drawLog(nb, "capturando"); await wait(360);
  }
  ph.state = "done"; drawPhone(ph, "Log salvo no notebook"); drawLog(nb, "análise");
  setBenchView("notebook"); await wait(400);
  const key = (h, dx) => wristForTip(h, new THREE.Vector3(nb.g.position.x + dx, world.benchTop + 0.03, nb.g.position.z - 0.01));
  rig.L.pose = rig.R.pose = "type";
  await Promise.all([moveHand(rig.L, key(rig.L, -0.1), 420), moveHand(rig.R, key(rig.R, 0.1), 420)]);
  await analysis(s, nb, field?.samples ?? []);
  setBenchView("bench"); await restHands(380);
  const far = sideHand(ph.g.position.x);                     // desconecta com a mão do lado do telefone
  if (bench.plug) { far.pose = "pinch"; await moveHand(far, wristForGrip(far, bench.plug.position), 340, 0.03); }
  setCable(null); far.pose = "relax";
  await moveHand(far, handRest(far === rig.L ? "L" : "R"), 340);
  G.run.bench.idx++; G.run.bench.sub = 0;
  if (G.run.bench.idx >= G.run.ch.scenarios.length) {
    setPhase("return"); drawLog(nb, "todos os logs salvos");
    toast("Todos os telefones testados! Recolha os materiais e devolva ao armário.", "good");
  }
}


// estação e modo deste módulo (game/registry.js)
registerStation("bench", { label: () => (phase === "bench" && player.carrying ? "Colocar materiais na mesa" : phase === "return" && !G.run.bench.packed ? "Recolher os materiais da bancada" : "Usar a bancada"), open: useBench });
registerMode("bench", {
  objective: () => (G.benchView === "notebook" ? "Use o notebook: clique nas opções da tela (ou teclas A–D)." : benchHint()),
  prompt: () => {
    if (G.benchView !== "bench") return null;
    const a = benchAction();
    return { key: "bench:" + (a ? a.label : "") + G.busy, html: G.busy ? `<button class="sec" disabled>⏳ Trabalhando…</button>` : `${a ? `<button id="pAct"><kbd>E</kbd>${esc(a.label)}</button>` : ""}<button class="sec" id="pExit"><kbd>Esc</kbd>Sair da bancada</button>` };
  },
  primary: () => doBenchAction(),
  escape: () => { if (G.benchView === "bench") setMode("free"); }
});

export { doBenchAction };
