import { t, getLang } from "./i18n.js";

async function fetchOk(path, init) {
  const response = await fetch(path, init);
  if (!response.ok) throw new Error(t("data.http", { path, status: response.status }));
  return response;
}

const isPlainObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);

// Applies a translation overlay onto the pt-BR base. Arrays merge by index;
// an array of objects with `id` can be overlaid by an object keyed by id.
function mergeOverlay(base, overlay) {
  if (overlay === undefined) return base;
  if (Array.isArray(base) && isPlainObject(overlay)) {
    return base.map((item) => mergeOverlay(item, overlay[item.id]));
  }
  if (Array.isArray(base) && Array.isArray(overlay)) {
    return base.map((item, index) => mergeOverlay(item, overlay[index]));
  }
  if (isPlainObject(base) && isPlainObject(overlay)) {
    const merged = { ...base };
    for (const [key, value] of Object.entries(overlay)) merged[key] = mergeOverlay(base[key], value);
    return merged;
  }
  return overlay;
}

async function loadChallenge(path, lang) {
  const base = await (await fetchOk(path)).json();
  if (lang === "pt-BR") return base;
  const overlayPath = path.replace(/^data\//, `data/i18n/${lang}/`);
  const response = await fetch(overlayPath);
  return response.ok ? mergeOverlay(base, await response.json()) : base;
}

export async function loadCatalog(lang = getLang(), indexPath = "data/desafios.json") {
  const index = await (await fetchOk(indexPath)).json();
  const challenges = await Promise.all(index.challenges.map((path) => loadChallenge(path, lang)));
  return { challenges, defaults: index.default };
}

export const findChallenge = (catalog, id) => catalog.challenges.find((challenge) => challenge.id === id);
export const findScenario = (challenge, id) => challenge.scenarios.find((scenario) => scenario.id === id);

function parseLogTimestamp(value) {
  if (!value) return NaN;
  return Date.parse(value.includes("T") ? value : value.replace(" ", "T"));
}

// The original log HTML files embed their messages in <script id="log-data">.
// Reading them directly keeps the published logs as the single source.
// `timeReference.idx` names the log event the case measures its times from
// (e.g. Measurement Configuration #2 = T 0); events then carry `refTimeMs`.
async function loadLogFile(path, signal, timeReference) {
  const text = await (await fetchOk(path, { signal })).text();
  const doc = new DOMParser().parseFromString(text, "text/html");
  const dataElement = doc.querySelector("#log-data");
  if (!dataElement) throw new Error(t("data.noLogData", { path }));
  const data = JSON.parse(dataElement.textContent);
  if (!Array.isArray(data) || data.length === 0) throw new Error(t("data.emptyLog", { path }));
  const start = parseLogTimestamp(data[0].ts);
  const referenceEntry = timeReference && data.find((entry) => Number(entry.idx) === timeReference.idx);
  const reference = referenceEntry ? parseLogTimestamp(referenceEntry.ts) : NaN;
  return data.map((entry, index) => {
    const timestamp = parseLogTimestamp(entry.ts);
    const valid = Number.isFinite(timestamp);
    return {
      ...entry,
      replayTimeMs: valid && Number.isFinite(start) ? Math.max(0, timestamp - start) : index * 250,
      ...(valid && Number.isFinite(reference) ? { refTimeMs: timestamp - reference } : {})
    };
  });
}

function stepsToEvents(scenario) {
  return scenario.playbackSteps.map((step, index) => ({
    idx: index + 1,
    ts: "",
    replayTimeMs: step.offsetMs,
    ...(scenario.stepsTimed ? { refTimeMs: step.offsetMs } : {}),
    rat: scenario.rat || "NR",
    aggregate: true,
    protocol: t("case.protocol"),
    channel: t("case.channel"),
    direction: t("case.direction"),
    msg: step.msg,
    summary: step.summary,
    full: step.details || step.summary
  }));
}

export async function loadScenarioEvents(scenario, signal) {
  if (scenario.playbackSteps) return stepsToEvents(scenario);
  if (!scenario.logPath) throw new Error(t("data.noSource"));
  return loadLogFile(scenario.logPath, signal, scenario.timeReference);
}

export async function loadReport(challenge) {
  const date = new Intl.DateTimeFormat(getLang(), { dateStyle: "long" }).format(new Date());
  const template = await (await fetchOk(challenge.report.template)).text();
  return template.replaceAll("{{data}}", date);
}
