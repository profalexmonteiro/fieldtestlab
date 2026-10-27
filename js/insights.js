// Derives the measurement evidence of a log: RSRP series per layer, filtered
// BLER, the A5 entry condition, the T310 race and the RACH attempts. Pure
// functions over loaded events (with refTimeMs); no DOM, no translations, so
// the same trace feeds the chart, the scene race and the comparison views.

const number = (text, pattern) => {
  const value = Number(String(text || "").match(pattern)?.[1]);
  return Number.isFinite(value) ? value : NaN;
};

// "NR-ARFCN 504990: PCI 160 -100.9dBm/-12.0dB, PCI 145 -100.6dBm/-11.6dB"
// "NR-ARFCN 633180: PCI 88 RSRP -78.4dBm RSRQ -9.2dB, ..."
function layerRsrp(event, arfcn, pci) {
  if (!/Measurement Database Update/i.test(event.msg || "")) return NaN;
  const summary = String(event.summary || "");
  if (!summary.startsWith(`NR-ARFCN ${arfcn}:`)) return NaN;
  return number(summary, new RegExp(`PCI ${pci}\\s+(?:RSRP\\s+)?(-?\\d+(?:\\.\\d+)?)dBm`, "i"));
}

const pciOf = (event) => String(event.cell || "").match(/PCI\s*(\d+)/i)?.[1] || "";
const arfcnOf = (event) => String(event.cell || "").match(/NrArfcn\s*(\d+)/i)?.[1] || "";
const at = (event, index) => event && { t: event.refTimeMs, index, idx: Number(event.idx) };

// Random-access procedures: each RACH Trigger opens a group that collects its
// Msg1 power records and the attempt results that follow on the same cell.
function rachGroups(events) {
  const groups = [];
  let group = null;
  events.forEach((event, index) => {
    const msg = event.msg || "";
    const summary = event.summary || "";
    if (/RACH Trigger/i.test(msg)) {
      const pci = pciOf(event);
      const sCheck = [...events.slice(0, index)].reverse()
        .find((item) => /S Criteria/i.test(item.msg || "") && pciOf(item) === pci && item.refTimeMs >= event.refTimeMs - 1000);
      group = {
        ...at(event, index),
        cause: summary.trim(),
        pci,
        arfcn: arfcnOf(event),
        sCriterion: sCheck ? (/FAILURE/i.test(sCheck.summary) ? "fail" : "pass") : "",
        sCriterionIdx: sCheck ? Number(sCheck.idx) : 0,
        attempts: [],
        maxAttempts: 0,
        result: ""
      };
      groups.push(group);
      return;
    }
    if (!group || pciOf(event) !== group.pci) return;
    const attempt = number(summary, /PRACH attempt\s*(\d+)/i);
    if (Number.isFinite(attempt)) {
      group.attempts.push({
        ...at(event, index),
        n: attempt,
        power: number(summary, /transmit_power\s*(-?[\d.]+)\s*dBm/i),
        pathloss: number(summary, /pathloss\s*(-?[\d.]+)\s*dB/i),
        maxPower: number(event.full, /mtpl\s*:\s*(-?[\d.]+)/i),
        targetPower: number(event.full, /prach_target_power\s*:\s*(-?[\d.]+)/i),
        outcome: ""
      });
      return;
    }
    if (/RACH Attempt/i.test(msg)) {
      const last = group.attempts[group.attempts.length - 1];
      const ok = /SUCCESS/i.test(summary);
      if (last && !last.outcome) {
        last.outcome = ok ? "ok" : "fail";
        last.outcomeIdx = Number(event.idx);
      }
      group.maxAttempts = number(summary, /attempt\s*\d+\s*\/\s*(\d+)/i) || group.maxAttempts;
      group.result = ok ? "ok" : "fail";
      group.resultIdx = Number(event.idx);
    }
  });
  return groups;
}

const median = (values) => {
  if (!values.length) return NaN;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};

// `config` is the challenge's `insights` block (layers, A5, RLM, gaps).
export function buildTrace(events, config) {
  const { serving, target, a5, rlm } = config;
  const timed = events.filter((event) => Number.isFinite(event.refTimeMs));
  const find = (test, from = 0) => {
    const index = events.findIndex((event, i) => i >= from && Number.isFinite(event.refTimeMs) && test(event));
    return index >= 0 ? at(events[index], index) : null;
  };

  const servingSeries = [];
  const targetSeries = [];
  const bler = [];
  events.forEach((event, index) => {
    if (!Number.isFinite(event.refTimeMs)) return;
    const s = layerRsrp(event, serving.arfcn, serving.pci);
    if (Number.isFinite(s)) servingSeries.push({ ...at(event, index), value: s });
    const n = layerRsrp(event, target.arfcn, target.pci);
    if (Number.isFinite(n)) targetSeries.push({ ...at(event, index), value: n });
    if (/RLM Stats/i.test(event.msg || "")) {
      const value = number(event.summary, /OOS_FILT_BLER\s*([\d.]+)%/i);
      if (Number.isFinite(value)) bler.push({ ...at(event, index), value });
    }
  });

  const measConfig = find((event) => event.refTimeMs === 0);
  const rlf = find((event) => /Radio Link Failure Declared/i.test(event.msg || ""));
  const end = rlf ? rlf.t : Infinity;

  // A5 entering condition (TS 38.331 5.5.4.6): Mp + Hys < Thresh1 and
  // Mn − Hys > Thresh2, evaluated on the latest L3 values the UE logged.
  const servingEntry = a5.threshold1 - a5.hysteresis;
  const targetEntry = a5.threshold2 + a5.hysteresis;
  let a5Met = null;
  let latestServing = NaN;
  let latestTarget = NaN;
  for (const sample of [...servingSeries.map((s) => ({ ...s, layer: "s" })), ...targetSeries.map((s) => ({ ...s, layer: "n" }))]
    .filter((sample) => sample.t >= 0 && sample.t < end)
    .sort((a, b) => a.t - b.t || a.index - b.index)) {
    if (sample.layer === "s") latestServing = sample.value; else latestTarget = sample.value;
    if (latestServing < servingEntry && latestTarget > targetEntry) {
      a5Met = { t: sample.t, index: sample.index, idx: sample.idx, serving: latestServing, target: latestTarget };
      break;
    }
  }

  const report = find((event) => /^Measurement Report$/i.test(event.msg || "") && new RegExp(`measId\\s*=\\s*${a5.measId}\\b`).test(event.summary || ""));
  const hoCommand = find((event) => /^RRCReconfiguration$/i.test(event.msg || "") && /reconfigurationWithSync|Handover Command/i.test(event.summary || ""));
  const hoComplete = find((event) => /^RRCReconfigurationComplete$/i.test(event.msg || "") && /handover complete/i.test(event.summary || ""));
  const oosCross = find((event) => /RLM Stats/i.test(event.msg || "") && number(event.summary, /OOS_FILT_BLER\s*([\d.]+)%/i) >= rlm.outOfSyncBler);
  const reestComplete = find((event) => /^RRCReestablishmentComplete$/i.test(event.msg || ""));
  const restored = find((event) => /^Service Restored$/i.test(event.msg || ""));
  // The log has no T310 start record; it is inferred from the expiry.
  const t310Start = rlf ? { t: rlf.t - rlm.t310Ms, inferred: true } : null;
  if (t310Start) {
    const nearest = [...timed].reverse().find((event) => event.refTimeMs <= t310Start.t);
    t310Start.idx = nearest ? Number(nearest.idx) : 0;
  }
  const t304 = [...timed].reverse().find((event) => /T304 Remain_Time/i.test(event.summary || ""));

  // Connected-mode cadence of the target layer, between MeasConfig and the
  // report (or the RLF, whichever comes first).
  const cadenceEnd = Math.min(report ? report.t : Infinity, end);
  const cadence = targetSeries.filter((sample) => sample.t >= 0 && sample.t <= cadenceEnd);
  const intervals = cadence.slice(1).map((sample, i) => sample.t - cadence[i].t).filter((value) => value > 0);
  const idleTarget = [...targetSeries].reverse().find((sample) => sample.t < 0);

  // After an RLF: time spent on the old layer before the UE looks at the target one.
  let reselection = null;
  if (rlf) {
    const firstOld = find((event) => /ACQ Config/i.test(event.msg || "") && arfcnOf(event) === serving.arfcn, rlf.index);
    const firstTarget = find((event) => /ACQ Config/i.test(event.msg || "") && arfcnOf(event) === target.arfcn, rlf.index);
    const bestKnown = [...targetSeries].reverse().find((sample) => sample.t <= rlf.t);
    reselection = {
      oldLayer: firstOld,
      targetLayer: firstTarget,
      oldLayerMs: firstOld && firstTarget ? firstTarget.t - firstOld.t : NaN,
      bestKnown: bestKnown || null
    };
  }

  const milestones = { measConfig, a5Met, report, hoCommand, hoComplete, oosCross, t310Start, rlf, reestComplete, restored };
  return {
    serving: servingSeries,
    target: targetSeries,
    bler,
    milestones,
    thresholds: { servingEntry, targetEntry },
    serviceBack: hoComplete || reestComplete || null,
    t304RemainingMs: t304 ? number(t304.summary, /Remain_Time\s*(\d+)/i) : NaN,
    cadence: {
      samples: cadence,
      medianMs: median(intervals),
      minMs: intervals.length ? Math.min(...intervals) : NaN,
      maxMs: intervals.length ? Math.max(...intervals) : NaN,
      gapsPerSample: median(intervals) / config.gap.mgrpMs
    },
    idleTarget: idleTarget || null,
    firstGapTarget: cadence[0] || null,
    maxBler: bler.filter((sample) => sample.t >= 0).reduce((max, sample) => Math.max(max, sample.value), 0),
    rach: rachGroups(events).filter((group) => group.t >= 0),
    reselection
  };
}

// State of the mobility race at time `t` (ms since the reference).
export function raceState(trace, t, config) {
  const m = trace.milestones;
  const ttt = config.a5.tttMs;
  const a5 = !m.a5Met || t < m.a5Met.t
    ? { state: "waiting" }
    : m.report && t >= m.report.t
      ? { state: "sent", afterMs: m.report.t - m.a5Met.t, lateMs: m.report.t - m.a5Met.t - ttt }
      : { state: "pending", sinceMs: t - m.a5Met.t, overdue: t - m.a5Met.t > ttt };
  const t310 = !m.t310Start || t < m.t310Start.t
    ? { state: "idle" }
    : m.rlf && t >= m.rlf.t
      ? { state: "expired" }
      : { state: "running", elapsedMs: t - m.t310Start.t, remainingMs: m.t310Start.t + config.rlm.t310Ms - t };
  const ho = !m.hoCommand || t < m.hoCommand.t
    ? { state: "none" }
    : m.hoComplete && t >= m.hoComplete.t
      ? { state: "done", t304RemainingMs: trace.t304RemainingMs }
      : { state: "running", elapsedMs: t - m.hoCommand.t };
  const reselect = trace.reselection;
  const recovery = !m.rlf || t < m.rlf.t
    ? { state: "none" }
    : m.reestComplete && t >= m.reestComplete.t
      ? { state: "restored" }
      : {
          state: reselect?.targetLayer && t >= reselect.targetLayer.t ? "target" : "old",
          bestKnown: reselect?.bestKnown || null
        };
  return { a5, t310, ho, recovery, reportT310RemainingMs: m.report && m.t310Start && m.rlf ? m.rlf.t - m.report.t : NaN };
}
