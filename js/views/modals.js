import { $ } from "../dom.js";
import { loadReport } from "../data.js";
import { t } from "../i18n.js";

function openModal(id) {
  document.getElementById(id).classList.add("open");
  document.body.style.overflow = "hidden";
}

function closeModal(id) {
  document.getElementById(id).classList.remove("open");
  if (!document.querySelector(".modal.open")) document.body.style.overflow = "";
}

// Log viewer and issue report. `getCurrent` returns { challenge, scenario }.
export function mountModals({ getCurrent }) {
  document.querySelectorAll("[data-close]").forEach((button) => button.addEventListener("click", () => closeModal(button.dataset.close)));
  document.querySelectorAll(".modal").forEach((modal) => modal.addEventListener("click", (event) => {
    if (event.target === modal) closeModal(modal.id);
  }));
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") document.querySelectorAll(".modal.open").forEach((modal) => closeModal(modal.id));
  });

  $("#open-log").addEventListener("click", () => {
    const { scenario } = getCurrent();
    if (!scenario.logPath) return;
    const frame = $("#log-frame");
    if (frame.dataset.path !== scenario.logPath) {
      frame.src = scenario.logPath;
      frame.dataset.path = scenario.logPath;
    }
    openModal("log-modal");
  });

  async function showReport() {
    const { challenge } = getCurrent();
    $("#report-modal-title").textContent = challenge.report.title;
    try {
      $("#report-content").innerHTML = await loadReport(challenge);
    } catch (error) {
      $("#report-content").textContent = t("modal.reportError", { error: error.message });
      console.error(error);
    }
    openModal("report-modal");
  }
  $("#open-report").addEventListener("click", showReport);
  $("#print-report").addEventListener("click", async () => {
    await showReport();
    setTimeout(() => window.print(), 120);
  });

  return function render(scenario) {
    $("#log-modal-title").textContent = scenario.logPath ? t("modal.logTitle", { device: scenario.device }) : t("modal.logUnavailable");
    $("#log-modal-subtitle").textContent = scenario.logLabel;
  };
}
