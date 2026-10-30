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
    // `rightProtocols` sends a protocol's messages to the right node (e.g. SIP to the IMS core).
    const viaRightProtocol = (scenario.rightProtocols || []).includes(event.protocol);
    const targetsRight = viaRightProtocol || Boolean(pci && cellPcis(scenario.rightCell).includes(pci) && !cellPcis(scenario.leftCell).includes(pci));
    // A core node on the right is reached through the left cell and the transport network.
    const viaCore = targetsRight && scenario.rightKind === "core";
    // `coreNodes` + `coreProtocols`: e.g. NAS ends in the AMF behind the cell that carries it.
    const side = targetsRight && !viaCore ? "right" : "left";
    const edgeCore = !viaCore && (scenario.coreProtocols || []).includes(event.protocol) ? scenario.coreNodes?.[side] : "";
    const nodeName = (node) => node.split("·")[0].trim() || t("signal.radio");
    const cellNode = side === "right" ? scenario.rightNode : scenario.leftNode;
    const cellName = `${nodeName(cellNode)}${pci && !(viaRightProtocol && !viaCore) ? ` · PCI ${pci}` : ""}`;
    const farName = viaCore ? nodeName(scenario.rightNode) : edgeCore ? nodeName(edgeCore) : "";
    // Hops listed from the UE outwards; the downlink label reverses them.
    const target = !farName ? cellName : isDownlink ? `${farName} → ${cellName}` : `${cellName} → ${farName}`;

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
      const { phone } = sceneGeometry(width, height, scenario.rightKind);
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
    const geo = sceneGeometry(width, height, scenario.rightKind);
    const cell = geo[side];
    const lift = 10;
    const cellEnd = `${cell.antenna.x} ${cell.antenna.y - lift}`;
    const phoneEnd = `${cell.ue.x} ${cell.ue.y - lift}`;
    // Via a core node: radio hop to the cell, down its mast, then along the transport line.
    const far = viaCore ? geo.core : edgeCore ? geo.edge[side] : null;
    const coreLeg = far
      ? [cellEnd, `${far.site.x} ${far.site.y - 6}`, `${far.entry.x} ${far.entry.y - 6}`]
      : [cellEnd];
    const directed = isUplink || isDownlink;
    const points = isUplink ? [phoneEnd, ...coreLeg] : [...coreLeg].reverse().concat(phoneEnd);
    const route = `M ${points.join(" L ")}`;

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
