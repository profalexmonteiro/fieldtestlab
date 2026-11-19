import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { analyzeEvents } from "../js/analyzer.js";
import { aggregateKpis, iterationProblems, kpiVerdict } from "../js/views/kpitest.js";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const challenge = JSON.parse(read("data/desafio-7.json"));
const english = JSON.parse(read("data/i18n/en/desafio-7.json"));
const { kpiTest } = challenge;
const logData = (id, html) => JSON.parse(html.match(new RegExp(`<script[^>]*id="${id}"[^>]*>([\\s\\S]*?)</script>`))[1]);

test("veredito oficial usa 11 pares e mantém os critérios de média e estabilidade separados", () => {
  const invalid = kpiTest.iterations.filter((row) => iterationProblems(row, kpiTest.criteria).length);
  assert.deepEqual(invalid.map(({ it }) => it), [3, 7, 9, 12]);
  const official = kpiVerdict(kpiTest, "valid");
  assert.equal(official.used.length, 11);
  assert.equal(official.conclusive, true);
  assert.equal(official.pass, false);
  assert.deepEqual([official.dl.passMean, official.ul.passMean, official.dl.passSigma, official.ul.passSigma], [false, false, true, false]);
  assert.deepEqual([official.dl.dMean, official.ul.dMean, official.dl.dSigma, official.ul.dSigma].map((n) => n.toFixed(2)),
    ["-38.98", "-49.90", "-16.84", "262.79"]);

  const simulation = kpiVerdict(kpiTest, "all");
  assert.equal(simulation.used.length, 15);
  assert.deepEqual([simulation.dl.passMean, simulation.ul.passMean, simulation.dl.passSigma, simulation.ul.passSigma], [false, false, false, true]);
  assert.equal(kpiVerdict({ ...kpiTest, iterations: official.used.slice(0, 9) }, "valid").conclusive, false);
});

test("fontes, guias PT/EN e decomposição dos contadores conferem com os logs originais", () => {
  assert.match(read(challenge.report.template), /Relatório de Issue/);
  assert.match(read(english.report.template), /Issue Report/);
  for (const scenario of challenge.scenarios) {
    const html = read(scenario.logPath);
    const events = logData("log-data", html);
    const keyed = new Map(events.map((event) => [Number(event.idx), event]));
    assert.equal(events.length, 191);
    assert.equal(keyed.get(scenario.timeReference.idx).msg, "iPerf3 Session Start");
    assert.ok(scenario.guide.every(({ idx }) => keyed.has(idx)));
    assert.equal(english.scenarios[scenario.id].guide.length, scenario.guide.length);

    const { meta, rows } = logData("kpi-data", html);
    assert.equal(meta.arfcn, kpiTest.criteria.arfcn);
    assert.deepEqual(rows.map(({ t }) => t), Array.from({ length: 60 }, (_, index) => index + 1));
    const kpi = aggregateKpis(rows);
    const toMbps = 8 / 1e6;
    assert.ok(Math.abs(kpi.dFirstRate * kpi.dTbsPerLayer * kpi.dLayers * kpi.dDelivered * toMbps - kpi.dAcked) < 1e-9);
    assert.ok(Math.abs(kpi.uGrantRate * kpi.uTbs * kpi.uNewShare * kpi.uDelivered * toMbps - kpi.uAcked) < 1e-9);
    assert.equal(kpi.uHarqFail * rows.length, scenario.id === kpiTest.dut ? 5393 : 10);
  }
});

test("alertas de HARQ exigem pareamento dos grants e PUSCH do mesmo trecho", () => {
  const logs = Object.fromEntries(challenge.scenarios.map((scenario) =>
    [scenario.id, logData("log-data", read(scenario.logPath))]));
  const invalid = analyzeEvents(logs[kpiTest.dut]).filter(({ analysis }) => analysis.retxIgnored);
  assert.equal(invalid.length, 8);
  assert.match(invalid.find(({ idx }) => Number(idx) === 24494).analysis.procedure, /7.*7/);
  assert.match(invalid.find(({ idx }) => Number(idx) === 24561).analysis.procedure, /3.*3/);
  assert.equal(analyzeEvents(logs[kpiTest.cdut]).filter(({ analysis }) => analysis.retxIgnored).length, 0);

  const grant = logs[kpiTest.dut].find(({ idx }) => Number(idx) === 24492);
  const pusch = logs[kpiTest.dut].find(({ idx }) => Number(idx) === 24494);
  const otherProcess = { ...pusch, full: pusch.full.replace("harq_id : 15", "harq_id : 12") };
  assert.equal(analyzeEvents([grant, otherProcess])[1].analysis.retxIgnored, undefined);
  assert.equal(analyzeEvents([grant, { msg: "Radio Snapshot" }, pusch])[2].analysis.retxIgnored, undefined);
  const stale = { ...pusch, ts: "2026-11-05 10:00:35.133000" };
  assert.equal(analyzeEvents([grant, stale])[1].analysis.retxIgnored, undefined);
});
