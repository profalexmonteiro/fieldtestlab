import { $, el, svgEl, formatNumber } from "../dom.js";
import { t, getLang } from "../i18n.js";
import { raceState } from "../insights.js";
import { sceneGeometry } from "./scene.js";

const ms = (value) => `${Math.round(value).toLocaleString(getLang(), { useGrouping: false })} ms`;

// The mobility race on the scene: a timer ring around the UE (T310 red,
// T304 green), the best already-measured cell after an RLF, and a status
// strip below the scene. All state comes from the trace at the current time.
export function mountRaceView() {
  const svg = $("#race-overlay");
  const strip = $("#race-strip");
  let last = null;
  new ResizeObserver(() => last && draw(...last)).observe($(".scene"));

  function draw(race, scenario, config) {
    const bounds = $(".scene").getBoundingClientRect();
    const width = Math.max(bounds.width, 1);
    const height = Math.max(bounds.height, 1);
    svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
    svg.replaceChildren();
    if (!race) return;
    const geo = sceneGeometry(width, height);
    const { phone } = geo;

    const timer = race.t310.state === "running"
      ? { kind: "t310", fraction: race.t310.elapsedMs / config.rlm.t310Ms, label: ms(race.t310.remainingMs) }
      : race.t310.state === "expired" && race.recovery.state !== "restored"
        ? { kind: "t310", fraction: 1, label: "RLF" }
        : race.ho.state === "running"
          ? { kind: "t304", fraction: race.ho.elapsedMs / 2000, label: "T304" }
          : null;
    if (timer) {
      const r = phone.height * 0.72;
      const cx = phone.x;
      const cy = phone.y;
      const circumference = 2 * Math.PI * r;
      svg.append(
        svgEl("circle", { cx, cy, r, class: `race-ring-track ${timer.kind}` }),
        svgEl("circle", {
          cx, cy, r,
          class: `race-ring ${timer.kind}`,
          "stroke-dasharray": `${circumference * Math.min(1, timer.fraction)} ${circumference}`,
          transform: `rotate(-90 ${cx} ${cy})`
        })
      );
      const text = svgEl("text", { x: cx + r + 6, y: cy - r + 10, class: `race-ring-label ${timer.kind}` });
      text.textContent = `${timer.kind === "t310" ? "T310" : ""} ${timer.label}`.trim();
      svg.append(text);
    }

    // After the RLF, while the UE is still on the old layer: show where the
    // better cell was, using the UE's own last measurement of it.
    const best = race.recovery.state === "old" ? race.recovery.bestKnown : null;
    if (best) {
      const side = new RegExp(`PCI\\s*${config.target.pci}\\b`).test(scenario.rightCell) ? geo.right : geo.left;
      const r = 34 * geo.s;
      svg.append(svgEl("circle", { cx: side.antenna.x, cy: side.antenna.y, r, class: "race-ghost" }));
      // Below the halo, towards the UE: the event chip covers the top of the scene.
      const label = svgEl("text", {
        x: side.antenna.x + (side === geo.right ? -r * 0.6 : r * 0.6),
        y: side.antenna.y + r + 13,
        class: "race-ghost-label",
        "text-anchor": side === geo.right ? "end" : "start"
      });
      label.textContent = t("race.ghost", { pci: config.target.pci, value: formatNumber(best.value) });
      svg.append(label);
    }
  }

  return function render(state, challenge, scenario) {
    const config = challenge.insights;
    const trace = config && state.traces?.challengeId === challenge.id ? state.traces.byScenario?.[scenario.id] : null;
    strip.hidden = !trace;
    if (!trace) {
      last = [null, scenario, config];
      draw(null, scenario, config);
      return;
    }
    const event = state.replay.events[state.replay.index];
    const time = event && Number.isFinite(event.refTimeMs) ? event.refTimeMs : -Infinity;
    const race = event ? raceState(trace, time, config) : null;
    last = [race, scenario, config];
    draw(race, scenario, config);
    strip.replaceChildren(...pills(race, trace, config, time));
  };
}

function pill(tone, label, value, extra) {
  return el("div", { className: `race-pill ${tone}` },
    el("span", { className: "race-pill-label" }, label),
    el("span", { className: "race-pill-value" }, value),
    extra || null);
}

function bar(fraction, tone) {
  const outer = el("span", { className: `race-bar ${tone}` });
  outer.append(el("span", { style: `width:${Math.max(0, Math.min(1, fraction)) * 100}%` }));
  return outer;
}

function pills(race, trace, config, time) {
  const ttt = config.a5.tttMs;
  if (!race) return [pill("neutral", t("race.title"), t("race.idle"))];

  let a5;
  if (time < 0) a5 = pill("neutral", "A5", t("race.a5.notConfigured"));
  else if (race.a5.state === "waiting") a5 = pill("neutral", "A5", t("race.a5.waiting"));
  else if (race.a5.state === "pending") {
    a5 = pill(race.a5.overdue ? "bad" : "warn", "A5",
      race.a5.overdue
        ? t("race.a5.overdue", { since: ms(race.a5.sinceMs), late: ms(race.a5.sinceMs - ttt) })
        : t("race.a5.ttt", { since: ms(race.a5.sinceMs), ttt: ms(ttt) }),
      bar(race.a5.sinceMs / ttt, race.a5.overdue ? "bad" : "warn"));
  } else {
    const late = race.a5.lateMs > 200;
    const margin = Number.isFinite(race.reportT310RemainingMs) ? ` · ${t("race.a5.margin", { left: ms(race.reportT310RemainingMs) })}` : "";
    a5 = pill(late ? "bad" : "good", "A5", `${t("race.a5.sent", { after: ms(race.a5.afterMs) })}${margin}`);
  }

  const t310 = race.t310.state === "running"
    ? pill("bad", "T310", t("race.t310.running", { elapsed: ms(race.t310.elapsedMs), total: ms(config.rlm.t310Ms) }), bar(race.t310.elapsedMs / config.rlm.t310Ms, "bad"))
    : race.t310.state === "expired"
      ? pill("bad", "T310", t("race.t310.expired"))
      : pill(trace.milestones.rlf ? "neutral" : "good", "T310", t(trace.milestones.rlf ? "race.t310.idle" : "race.t310.never"));

  const items = [a5, t310];
  if (trace.milestones.hoCommand) {
    items.push(race.ho.state === "done"
      ? pill("good", t("race.ho.label"), t("race.ho.done", { left: ms(race.ho.t304RemainingMs) }))
      : race.ho.state === "running"
        ? pill("warn", t("race.ho.label"), t("race.ho.running", { elapsed: ms(race.ho.elapsedMs) }))
        : pill("neutral", t("race.ho.label"), t("race.ho.waiting")));
  }
  if (trace.milestones.rlf && race.recovery.state !== "none") {
    const best = race.recovery.bestKnown;
    const cells = { old: config.serving.pci, pci: config.target.pci };
    items.push(race.recovery.state === "restored"
      ? pill("good", t("race.recovery.label"), t("race.recovery.restored", cells))
      : race.recovery.state === "target"
        ? pill("warn", t("race.recovery.label"), t("race.recovery.target", cells))
        : pill("bad", t("race.recovery.label"), t("race.recovery.old", { ...cells, value: best ? formatNumber(best.value) : "—" })));
  }
  return items;
}
