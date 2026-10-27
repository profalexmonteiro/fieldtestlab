import { $, el, signedSeconds } from "../dom.js";
import { t } from "../i18n.js";

// Guided reading of a log: `scenario.guide` lists key events by log number.
// The callout explains the current key event and links to the next one; the
// toggle makes the replay pause on each of them.
export function mountGuideView({ onToggleGuided, onJump, onPlay }) {
  const callout = $("#guide-callout");
  const toggle = $("#guide-toggle");
  toggle.addEventListener("change", () => onToggleGuided(toggle.checked));
  callout.addEventListener("click", (event) => {
    const button = event.target.closest("button");
    if (!button) return;
    if (button.dataset.jump) onJump(Number(button.dataset.jump));
    else if (button.dataset.action === "play") onPlay();
  });

  return function render(state, scenario) {
    const guide = scenario.guide || [];
    $("#guide-toggle-wrap").hidden = !guide.length;
    callout.hidden = !guide.length;
    toggle.checked = Boolean(state.guided);
    if (!guide.length) return;

    const { events, index, playing } = state.replay;
    const event = events[index];
    const currentIdx = event ? Number(event.idx) : 0;
    const position = guide.findIndex((item) => item.idx === currentIdx);
    const next = guide.find((item) => item.idx > currentIdx);
    const previous = [...guide].reverse().find((item) => item.idx < currentIdx);
    const jump = (item, key) => item
      ? el("button", { type: "button", className: "button quiet", "data-jump": item.idx }, t(key, { idx: item.idx }))
      : null;
    const time = event && Number.isFinite(event.refTimeMs)
      ? ` · T ${signedSeconds(event.refTimeMs)}`
      : "";

    if (position >= 0) {
      const item = guide[position];
      callout.className = "guide-callout active";
      callout.replaceChildren(
        el("div", { className: "guide-step" }, t("guide.step", { n: position + 1, total: guide.length, idx: item.idx }) + time),
        el("strong", { className: "guide-title" }, item.title),
        el("p", { className: "guide-text" }, item.text),
        el("div", { className: "guide-actions" },
          jump(previous, "guide.previous"),
          jump(next, "guide.next"),
          !playing && index < events.length - 1 ? el("button", { type: "button", className: "button primary", "data-action": "play" }, t("guide.continue")) : null)
      );
      return;
    }
    callout.className = "guide-callout";
    callout.replaceChildren(
      el("span", { className: "guide-hint" }, next
        ? t(event ? "guide.upcoming" : "guide.intro", { total: guide.length, title: next.title, idx: next.idx })
        : t("guide.finished", { total: guide.length })),
      el("div", { className: "guide-actions" }, jump(previous, "guide.previous"), jump(next, event ? "guide.next" : "guide.first"))
    );
  };
}

// Event indices (0-based) where guided playback pauses.
export function guideStops(scenario, events) {
  const keys = new Set((scenario.guide || []).map((item) => item.idx));
  const stops = new Set();
  events.forEach((event, index) => { if (keys.has(Number(event.idx))) stops.add(index); });
  return stops;
}
