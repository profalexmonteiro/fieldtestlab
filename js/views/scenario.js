import { $, el } from "../dom.js";
import { t, getLang } from "../i18n.js";

// Static content that only changes when the challenge or scenario changes.
export function mountScenarioView({ onSelectChallenge, onSelectScenario }) {
  const tabs = $("#challenge-tabs");
  tabs.addEventListener("click", (event) => {
    const button = event.target.closest("[data-challenge]");
    if (button) onSelectChallenge(button.dataset.challenge);
  });
  $("#scenario-list").addEventListener("click", (event) => {
    const button = event.target.closest("[data-scenario]");
    if (button) onSelectScenario(button.dataset.scenario);
  });

  return function render(catalog, challenge, scenario) {
    tabs.replaceChildren(...catalog.challenges.map((item) =>
      el("button", { className: "challenge-tab", type: "button", "data-challenge": item.id }, item.tab)
    ));
    tabs.querySelectorAll("[data-challenge]").forEach((button) => {
      button.setAttribute("aria-pressed", String(button.dataset.challenge === challenge.id));
    });
    $("#challenge-tag").replaceChildren(`${challenge.tag[0]} `, el("span", { style: "opacity:.55" }, "/"), ` ${challenge.tag[1]}`);
    $("#page-title").textContent = challenge.title;
    $("#page-description").textContent = challenge.description;
    $("#side-info").replaceChildren(...challenge.sideInfo.flatMap(({ label, value }, index) => [
      ...(index ? [el("br"), el("br")] : []), label, el("br"), el("strong", {}, value)
    ]));
    $("#challenge-resources").replaceChildren(...challenge.materials.map(({ label, href }) =>
      el("a", { className: "resource-link", href, target: "_blank", rel: "noopener" }, `${label} ↗`)
    ));
    $("#scenario-list").replaceChildren(...challenge.scenarios.map((item) =>
      el("button", { className: "scenario-button", type: "button", "data-scenario": item.id, "aria-current": String(item.id === scenario.id) },
        el("span", { className: "scenario-number" }, t("scenario.prefix", { number: item.number })),
        el("span", { className: "scenario-label" }, item.label))
    ));

    $("#scenario-kicker").textContent = scenario.kicker;
    $("#scenario-title").textContent = scenario.title;
    $("#scenario-description").textContent = scenario.description;
    $("#scenario-status").textContent = scenario.status;
    $("#scenario-status").className = `status-badge ${scenario.statusClass}`;
    $("#scene-device").textContent = scenario.device;
    $("#scene-state").textContent = scenario.state;
    $("#scene-left-node").textContent = scenario.leftNode;
    $("#scene-left-cell").textContent = scenario.leftCell;
    $("#scene-right-node").textContent = scenario.rightNode;
    $("#scene-right-cell").textContent = scenario.rightCell;
    $("#scene-rat").textContent = scenario.rat;
    $("#scene-network").textContent = scenario.network;

    const openLog = $("#open-log");
    $("#log-source").textContent = scenario.logLabel;
    openLog.disabled = !scenario.logPath;
    openLog.classList.toggle("quiet", !scenario.logPath);
    openLog.textContent = t(scenario.logPath ? "sources.openLog" : "sources.noLog");

    renderMetrics(scenario);
    renderTimeline(scenario);
    renderEvidence(scenario);
  };
}

function renderMetrics(scenario) {
  $("#metrics").replaceChildren(...scenario.metrics.map(({ label, value, note, tone }) =>
    el("div", { className: "metric" },
      el("div", { className: "metric-label" }, label),
      el("div", { className: `metric-value ${tone}` }, value),
      el("div", { className: "metric-note" }, note))
  ));
}

function renderTimeline(scenario) {
  // `timelineLabels` overrides the header when the bars are not ranges over the repetitions.
  const head = $("#timeline").closest("section");
  head.querySelector('[data-i18n="timeline.eyebrow"]').textContent = scenario.timelineLabels?.eyebrow || t("timeline.eyebrow");
  head.querySelector('[data-i18n="timeline.note"]').textContent = scenario.timelineLabels?.note || t("timeline.note");
  const maxTime = scenario.axisMax;
  const percent = (value) => Math.min(100, value / maxTime * 100);
  $("#timeline").replaceChildren(...scenario.rows.map((row) =>
    el("div", { className: "timeline-row" },
      el("div", { className: "timeline-name" }, row.label, el("small", {}, row.sub)),
      el("div", { className: "track" },
        el("span", { className: `range-bar ${row.color}`, style: `left:${percent(row.start)}%;width:${Math.max(1, (row.end - row.start) / maxTime * 100)}%` }),
        row.points.map((point) =>
          el("span", { className: `event-dot ${point.kind}`, style: `left:${percent(point.at)}%`, title: `${point.at.toFixed(3)} s` }))),
      el("div", { className: "timeline-value" }, row.final))
  ));
  $("#axis-marks").replaceChildren(...Array.from({ length: 5 }, (_, index) =>
    el("span", {}, `${(maxTime * index / 4).toLocaleString(getLang(), { maximumFractionDigits: 2 })} s`)
  ));
}

function renderEvidence(scenario) {
  $("#evidence").replaceChildren(...scenario.evidence.map(({ kind, title, html }) => {
    const text = el("p");
    text.innerHTML = html; // trusted course data; may contain <code>
    return el("div", { className: "evidence" },
      el("div", { className: "evidence-title" }, el("span", { className: `evidence-mark ${kind}` }, kind === "ok" ? "✓" : "!"), title),
      text);
  }));
  $("#scenario-notice").replaceChildren(el("div", { className: "notice" }, scenario.notice));
}
