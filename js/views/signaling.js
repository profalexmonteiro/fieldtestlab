import { $, svgEl } from "../dom.js";
import { t } from "../i18n.js";
import { sceneGeometry } from "./scene.js";

const cellPcis = (text) => [...text.matchAll(/PCI\s*(\d+)(?:\s*\/\s*(\d+))?/gi)].flatMap((match) => match.slice(1).filter(Boolean));

// Arrow overlay on the scene showing the direction of the current message.
// Colours come from CSS classes (.signal-path.ul/.dl/.internal).
export function mountSignalingView() {
  let last = null;
  new ResizeObserver(() => last && render(...last)).observe($(".scene"));

  function render(event, scenario) {
    last = [event, scenario];
    const svg = $("#signaling-overlay");
    const bounds = $(".scene").getBoundingClientRect();
    const width = Math.max(bounds.width, 1);
    const height = Math.max(bounds.height, 1);
    svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
    svg.replaceChildren();

    const chip = $("#signal-event-chip");
    const directionLabel = $("#signal-direction");
    const protocolLabel = $("#signal-protocol");
    const messageLabel = $("#signal-message");
    chip.className = "signal-event-chip";
    if (!event) {
      directionLabel.textContent = t("signal.idle");
      protocolLabel.textContent = "—";
      messageLabel.textContent = t("signal.idleMessage");
      chip.title = t("signal.idleTitle");
      return;
    }

    const direction = String(event.analysis?.direction || event.direction || "").trim();
    const isUplink = /^UL(?:\b|\s|\()/i.test(direction);
    const isDownlink = /^DL(?:\b|\s|\()/i.test(direction);
    const isInternal = direction.toUpperCase() === "EVENT" || String(event.channel || "").toLowerCase() === "internal";
    const pci = event.analysis?.pci;
    const targetsRight = Boolean(pci && cellPcis(scenario.rightCell).includes(pci) && !cellPcis(scenario.leftCell).includes(pci));
    const nodeType = (targetsRight ? scenario.rightNode : scenario.leftNode).split("·")[0].trim() || t("signal.radio");
    const target = `${nodeType}${pci ? ` · PCI ${pci}` : ""}`;

    protocolLabel.textContent = [event.protocol, event.channel].filter(Boolean).join(" · ") || t("signal.noProtocol");
    messageLabel.textContent = event.msg || event.summary || t("signal.noDescription");
    chip.title = [event.msg, event.summary, event.direction, event.full].filter(Boolean).join("\n");

    const kind = isUplink ? "ul" : isDownlink ? "dl" : "internal";
    const defs = svgEl("defs");
    const marker = svgEl("marker", { id: "signal-arrow", markerWidth: 8, markerHeight: 8, refX: 7, refY: 4, orient: "auto", markerUnits: "strokeWidth" });
    marker.append(svgEl("path", { d: "M0,0 L8,4 L0,8 Z", class: `signal-arrow-head ${kind}` }));
    defs.append(marker);
    svg.append(defs);

    if (isInternal) {
      chip.classList.add("internal");
      directionLabel.textContent = t("signal.internal");
      const { phone } = sceneGeometry(width, height);
      const top = phone.y - phone.height / 2;
      svg.append(svgEl("path", {
        d: `M ${phone.x - phone.width / 2 - 4} ${top + 6} Q ${phone.x} ${top - 26} ${phone.x + phone.width / 2 + 4} ${top + 6}`,
        class: "signal-path internal loop"
      }));
      return;
    }
    if (event.aggregate) {
      chip.classList.add("internal");
      directionLabel.textContent = t("signal.aggregate");
      return;
    }

    // Arrow runs just above the scene's antenna→UE link line.
    const cell = sceneGeometry(width, height)[targetsRight ? "right" : "left"];
    const lift = 10;
    const cellEnd = `${cell.antenna.x} ${cell.antenna.y - lift}`;
    const phoneEnd = `${cell.ue.x} ${cell.ue.y - lift}`;
    const directed = isUplink || isDownlink;
    const route = isUplink ? `M ${phoneEnd} L ${cellEnd}` : `M ${cellEnd} L ${phoneEnd}`;

    const path = svgEl("path", { d: route, class: `signal-path ${kind}${directed ? "" : " dashed"}` });
    if (directed) path.setAttribute("marker-end", "url(#signal-arrow)");
    const title = svgEl("title");
    title.textContent = [event.msg, event.direction, event.full].filter(Boolean).join(" · ");
    path.append(title);
    svg.append(path);

    if (directed) {
      const packet = svgEl("circle", { r: 4, class: `signal-packet ${kind}` });
      packet.append(svgEl("animateMotion", { dur: "1.1s", repeatCount: "indefinite", path: route }));
      svg.append(packet);
      const namedDirection = direction.replace(/\s*\([^)]*\)/g, "").trim() || (isUplink ? "UL" : "DL");
      const phoneLabel = t("signal.phone");
      directionLabel.textContent = isUplink
        ? `↑ ${namedDirection} · ${phoneLabel} → ${target}`
        : `↓ ${namedDirection} · ${target} → ${phoneLabel}`;
      chip.classList.add(kind);
    } else {
      directionLabel.textContent = t("signal.unknown");
      chip.classList.add("internal");
    }
  }

  return render;
}
