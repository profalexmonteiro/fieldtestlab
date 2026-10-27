import { $, el } from "../dom.js";
import { t, getLang } from "../i18n.js";
import { loadGlossary } from "../data.js";

// Accent- and case-insensitive text for searching ("critério" matches "criterio").
const fold = (text) => String(text).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

// Wraps the matches of `query` in <mark>, keeping the original text.
function highlight(text, query) {
  if (!query) return text;
  const folded = fold(text);
  const parts = [];
  let from = 0;
  for (let at = folded.indexOf(query); at >= 0; at = folded.indexOf(query, at + query.length)) {
    if (at > from) parts.push(text.slice(from, at));
    parts.push(el("mark", {}, text.slice(at, at + query.length)));
    from = at + query.length;
  }
  parts.push(text.slice(from));
  return parts;
}

// While searching, matches on the acronym come first, then on its meaning,
// then anywhere in the description.
function relevance(item, query) {
  if (!query) return 0;
  const term = fold(item.term);
  if (term === query) return 0;
  if (term.split(/[\s/·()]+/).some((word) => word.startsWith(query))) return 1;
  if (term.includes(query)) return 2;
  return fold(item.name).includes(query) ? 3 : 4;
}

// Glossary of acronyms and log codes, opened from the top bar. The list is
// loaded on first use per language; search and filters stay local to the dialog.
export function mountGlossary({ getChallenge, openModal }) {
  const search = $("#glossary-search");
  const chips = $("#glossary-categories");
  const only = $("#glossary-only");
  const body = $("#glossary-body");
  let glossary = null;
  let loadedLang = "";
  let category = "";

  async function open() {
    openModal("glossary-modal");
    if (loadedLang !== getLang()) {
      body.replaceChildren(el("p", { className: "glossary-empty" }, t("glossary.loading")));
      try {
        glossary = await loadGlossary();
        loadedLang = getLang();
      } catch (error) {
        body.replaceChildren(el("p", { className: "glossary-empty" }, t("glossary.error", { error: error.message })));
        console.error(error);
        return;
      }
    }
    render();
    requestAnimationFrame(() => search.focus());
  }

  function render() {
    if (!glossary) return;
    const challenge = getChallenge();
    $("#glossary-only-label").textContent = t("glossary.onlyChallenge", { challenge: challenge.tab });
    chips.replaceChildren(...[{ id: "", label: t("glossary.all") }, ...glossary.categories].map((item) =>
      el("button", { type: "button", className: "glossary-chip", "data-category": item.id, "aria-pressed": String(item.id === category) }, item.label)));

    const query = fold(search.value.trim());
    const labels = Object.fromEntries(glossary.categories.map((item) => [item.id, item.label]));
    const terms = glossary.terms
      .filter((item) => !category || item.category === category)
      .filter((item) => !only.checked || item.challenges.includes(challenge.id))
      .filter((item) => !query || fold(`${item.term} ${item.name} ${item.description}`).includes(query))
      .sort((a, b) => relevance(a, query) - relevance(b, query)
        || a.term.localeCompare(b.term, getLang(), { sensitivity: "base", numeric: true }));

    $("#glossary-count").textContent = t("glossary.count", { n: terms.length, total: glossary.terms.length });
    body.replaceChildren(terms.length
      ? el("table", { className: "glossary-table" },
          el("thead", {}, el("tr", {},
            el("th", { scope: "col" }, t("glossary.col.term")),
            el("th", { scope: "col" }, t("glossary.col.name")),
            el("th", { scope: "col" }, t("glossary.col.description")))),
          el("tbody", {}, terms.map((item) => el("tr", { id: `glossario-${item.id}` },
            el("th", { scope: "row", className: "glossary-term" }, highlight(item.term, query)),
            el("td", { className: "glossary-name" }, highlight(item.name, query),
              el("span", { className: `glossary-tag ${item.category}` }, labels[item.category] || item.category)),
            el("td", { className: "glossary-description" }, highlight(item.description, query))))))
      : el("p", { className: "glossary-empty" }, t("glossary.empty")));
  }

  $("#open-glossary").addEventListener("click", open);
  search.addEventListener("input", render);
  only.addEventListener("change", render);
  chips.addEventListener("click", (event) => {
    const chip = event.target.closest("[data-category]");
    if (!chip) return;
    category = chip.dataset.category;
    render();
  });

  // Re-render if the dialog is open when the language or challenge changes.
  return function refresh() {
    if (!$("#glossary-modal").classList.contains("open")) return;
    if (loadedLang !== getLang()) open();
    else render();
  };
}
