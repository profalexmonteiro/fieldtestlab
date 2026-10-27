import { el, signedSeconds, formatNumber } from "../dom.js";
import { t } from "../i18n.js";
import { pairContext, jumpButton, cursorTime, deviceName, deviceTag } from "./insight-common.js";

const P_MIN = -40; // dBm, bottom of the power scale
const P_MAX = 30;
const level = (power) => `${Math.max(2, (power - P_MIN) / (P_MAX - P_MIN) * 100)}%`;
const num = (value) => formatNumber(value);

// Tab 3: every random-access procedure after the reference event, DUT and
// CDUT side by side: Msg1 power ramp against the maximum power, pathloss,
// S criterion of the cell and, after a failure, the best cell the UE had
// already measured.
export function buildRach(ctx) {
  const { config } = ctx;
  const pair = pairContext(ctx);
  const bands = { [config.serving.arfcn]: config.serving.band, [config.target.arfcn]: config.target.band };
  const bars = [];

  const groupCard = (device, group) => {
    const max = group.attempts.find((attempt) => Number.isFinite(attempt.maxPower))?.maxPower;
    const lastAttempt = group.attempts[group.attempts.length - 1];
    const arriving = lastAttempt && Number.isFinite(lastAttempt.power) && Number.isFinite(lastAttempt.pathloss)
      ? lastAttempt.power - lastAttempt.pathloss : NaN;
    const failed = group.result === "fail";
    const best = failed && device.trace.reselection?.bestKnown;

    const chart = el("div", { className: "rach-chart" },
      Number.isFinite(max) ? el("span", { className: "rach-cap", style: `bottom:${level(max)}` }, t("rach.cap", { value: num(max) })) : null,
      group.attempts.map((attempt) => {
        const bar = jumpButton(device.id, attempt.idx, [
          el("span", { className: "rach-power" }, `${num(attempt.power)}`),
          el("span", { className: "rach-fill", style: `height:${level(attempt.power)}` }),
          el("span", { className: "rach-n" }, `#${attempt.n}`)
        ], `rach-bar ${attempt.outcome || "pending"}`);
        bar.title = `Msg1 ${attempt.n} · ${num(attempt.power)} dBm · pathloss ${num(attempt.pathloss)} dB · T ${signedSeconds(attempt.t)} · #${attempt.idx}`;
        bars.push([device.id, attempt.t, bar]);
        return bar;
      }));

    const sBadge = group.sCriterion
      ? jumpButton(device.id, group.sCriterionIdx, t(group.sCriterion === "fail" ? "rach.sFail" : "rach.sPass"), `rach-badge ${group.sCriterion === "fail" ? "bad" : "good"}`)
      : el("span", { className: "rach-badge neutral" }, t("rach.sNone"));
    const result = failed
      ? t("rach.resultFail", { n: group.attempts.length, max: group.maxAttempts || group.attempts.length })
      : t("rach.resultOk", { n: group.attempts.findIndex((attempt) => attempt.outcome === "ok") + 1 });

    return el("div", { className: `rach-group ${failed ? "bad" : "good"}` },
      el("div", { className: "rach-head" },
        el("strong", {}, `PCI ${group.pci} · ${bands[group.arfcn] || group.arfcn}`),
        el("span", { className: "rach-cause" }, group.cause),
        sBadge),
      chart,
      el("div", { className: "rach-meta" },
        el("span", {}, t("rach.pathloss", { value: num(lastAttempt?.pathloss ?? NaN) })),
        Number.isFinite(arriving) ? el("span", {}, t(Number.isFinite(lastAttempt.targetPower) ? "rach.arrivingTarget" : "rach.arriving", { value: num(arriving), target: num(lastAttempt.targetPower ?? NaN) })) : null,
        jumpButton(device.id, group.resultIdx || group.idx, result, `rach-result ${failed ? "bad" : "good"}`)),
      best ? el("div", { className: "rach-ghost" },
        el("span", { className: "rach-ghost-mark" }, "◎"),
        el("span", {}, t("rach.ghost", { pci: config.target.pci, band: config.target.band, value: num(best.value), time: signedSeconds(best.t) })),
        jumpButton(device.id, best.idx, `#${best.idx}`)) : null);
  };

  const column = (device) => el("div", { className: "rach-column" },
    el("div", { className: "rach-device" }, `${deviceTag(device.scenario)} · ${deviceName(device.scenario)}`),
    device.trace.rach.length
      ? device.trace.rach.map((group) => groupCard(device, group))
      : el("p", { className: "insight-empty" }, t("rach.none")));

  const node = el("div", { className: "insight-rach" },
    el("p", { className: "insight-sub" }, t("rach.intro")),
    el("div", { className: "rach-columns" }, column(pair.dut), column(pair.cdut)));

  return {
    node,
    update(state, scenario) {
      for (const [id, time, bar] of bars) {
        const now = cursorTime(state, scenario, id);
        bar.classList.toggle("future", now !== null && time > now);
      }
    }
  };
}
