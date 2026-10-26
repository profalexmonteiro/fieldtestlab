import { $, el } from "../dom.js";
import { t, getLang } from "../i18n.js";

const multiplier = (value) => () => `${value.toLocaleString(getLang())}×`;
const SPEEDS = [
  ["0.25", multiplier(0.25)],
  ["0.5", multiplier(0.5)],
  ["1", () => t("play.speedReal")],
  ["2", multiplier(2)],
  ["4", multiplier(4)]
];

export function mountPlaybackView({ replay }) {
  $("#play-toggle").addEventListener("click", replay.toggle);
  $("#play-step-back").addEventListener("click", () => replay.step(-1));
  $("#play-step-forward").addEventListener("click", () => replay.step(1));
  $("#play-restart").addEventListener("click", replay.restart);

  const log = $("#playback-log");
  log.addEventListener("click", (event) => {
    const toggle = event.target.closest(".playback-detail-toggle");
    if (toggle) {
      const detail = toggle.closest(".playback-entry").querySelector(".playback-detail");
      detail.hidden = !detail.hidden;
      toggle.textContent = detail.hidden ? t("entry.showDetail") : t("entry.hideDetail");
      return;
    }
    if (event.target.closest(".playback-detail")) return;
    const row = event.target.closest(".playback-entry");
    if (row) replay.seek(Number(row.dataset.index));
  });
  log.addEventListener("keydown", (event) => {
    const row = event.target.closest(".playback-entry");
    if (row && event.target === row && (event.key === "Enter" || event.key === " ")) {
      event.preventDefault();
      replay.seek(Number(row.dataset.index));
    }
  });

  let renderedEvents = null;

  function render(state, scenario) {
    const { events, index, playing, status, failed, message } = state.replay;
    const total = events.length;
    const shown = index + 1;
    const percentage = total ? shown / total * 100 : 0;

    $("#playback-kind").textContent = scenario.logPath ? t("play.kindLog") : t("play.kindSteps");
    $("#playback-source").textContent = message;
    $("#play-toggle").disabled = status === "loading";
    $("#play-toggle").textContent = playing ? t("play.pause") : t("play.play");
    $("#play-step-back").disabled = index <= 0;
    $("#play-step-forward").disabled = total > 0 && index >= total - 1;
    $("#play-count").textContent = `${Math.max(shown, 0)} / ${total}`;
    $("#play-progress").style.width = `${percentage}%`;
    $(".playback-progress").setAttribute("aria-valuenow", String(Math.round(percentage)));

    if (failed || index < 0) {
      renderedEvents = null;
      log.replaceChildren(el("div", { className: "playback-placeholder" }, placeholderText(state.replay, scenario)));
      return;
    }

    // Append when moving forward; rebuild only when the list shrank or changed.
    if (renderedEvents !== events || log.querySelectorAll(".playback-entry").length > shown) {
      renderedEvents = events;
      log.replaceChildren();
    }
    for (let i = log.querySelectorAll(".playback-entry").length; i < shown; i++) log.append(entryRow(events[i], i));
    log.querySelector(".playback-entry.current")?.classList.remove("current");
    const current = log.querySelector(`.playback-entry[data-index="${index}"]`);
    current?.classList.add("current");
    if (current) followRow(current);
  }

  // Keeps the current row visible by scrolling only the log box. Using
  // scrollIntoView here would also scroll the page and pull the viewer away
  // from the scene on every event. After a manual scroll inside the box,
  // following pauses briefly so the user can read.
  let autoScrollTop = null;
  let userScrolledAt = 0;
  log.addEventListener("scroll", () => {
    // Any position other than the one we set ourselves was the user's doing.
    if (autoScrollTop === null || Math.abs(log.scrollTop - autoScrollTop) > 2) userScrolledAt = Date.now();
    autoScrollTop = null;
  });
  // Scroll events arrive a frame late, so also catch the user's intent directly.
  const markUserScroll = () => { userScrolledAt = Date.now(); };
  for (const type of ["wheel", "touchstart", "pointerdown"]) log.addEventListener(type, markUserScroll, { passive: true });
  log.addEventListener("keydown", (event) => {
    if (["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End"].includes(event.key)) markUserScroll();
  });
  function followRow(row) {
    if (Date.now() - userScrolledAt < 4000) return;
    const rowBox = row.getBoundingClientRect();
    const logBox = log.getBoundingClientRect();
    let delta = 0;
    if (rowBox.top < logBox.top) delta = rowBox.top - logBox.top;
    else if (rowBox.bottom > logBox.bottom) delta = rowBox.bottom - logBox.bottom;
    if (delta) {
      log.scrollTop += delta;
      autoScrollTop = log.scrollTop;
    }
  }

  // Re-labels the speed options after a language change, keeping the selection.
  render.translate = () => {
    const select = $("#play-speed");
    const value = select.value || "1";
    select.replaceChildren(...SPEEDS.map(([optionValue, label]) => el("option", { value: optionValue }, label())));
    select.value = value;
  };
  render.translate();
  return render;
}

export const getSelectedSpeed = () => {
  const select = $("#play-speed");
  return { value: Number(select.value) || 1, label: select.selectedOptions[0]?.textContent || "1×" };
};

function placeholderText(replayState, scenario) {
  if (replayState.failed) return t("replay.placeholderError");
  if (replayState.events.length) return t("replay.placeholderLoaded");
  return scenario.logPath ? t("replay.placeholderLog") : t("replay.placeholderSteps");
}

function entryRow(event, index) {
  const attempt = event.attempt ? t("entry.attempt", { n: event.attempt }) : "";
  return el("div", {
    className: "playback-entry",
    "data-index": index,
    tabIndex: 0,
    role: "button",
    "aria-label": t("entry.aria", { index: index + 1, msg: event.msg }),
    title: t("entry.title")
  },
    el("span", { className: "playback-index" }, String(event.idx ?? index + 1).padStart(2, "0")),
    el("span", { className: "playback-time" }, event.ts
      || `T+${((event.replayTimeMs || 0) / 1000).toLocaleString(getLang(), { maximumFractionDigits: 2 })} s`,
      event.ts && Number.isFinite(event.refTimeMs)
        ? el("small", { className: "playback-reltime" }, `T ${event.refTimeMs < 0 ? "−" : "+"}${(Math.abs(event.refTimeMs) / 1000).toLocaleString(getLang(), { minimumFractionDigits: 3, maximumFractionDigits: 3 })} s`)
        : null),
    el("span", { className: "playback-message" },
      el("strong", {}, event.msg || t("entry.event")),
      el("small", {}, [event.summary, event.cell].filter(Boolean).join(" · ")),
      el("button", { type: "button", className: "playback-detail-toggle" }, t("entry.showDetail"))),
    el("span", { className: "playback-protocol" }, `${attempt}${event.rat || ""} ${event.protocol || ""}`.trim()),
    el("span", { className: "playback-direction" }, [event.channel, event.direction].filter(Boolean).join(" · ")),
    el("pre", { className: "playback-detail", hidden: true }, event.full || event.summary || event.msg || ""));
}
