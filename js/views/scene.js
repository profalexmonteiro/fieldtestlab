import { $, svgEl } from "../dom.js";
import { t, getLang } from "../i18n.js";

// Shared layout of the scene, in pixels. The signaling overlay uses the same
// anchor points so arrows leave from the antennas and reach the UE.
// `kind` "core" lays the scene out along the signal path: UE on the left, the
// cell (`left`) in the centre facing the UE, and the core node on the right.
export function sceneGeometry(w, h, kind = "ran") {
  const isCore = kind === "core";
  const s = Math.min(Math.max((h - 76) / 165, 0.5), 1.1);
  const baseY = h - 46;
  const phone = { x: isCore ? w * 0.2 : w / 2, y: baseY - 64 * s, width: 30 * s, height: 56 * s };
  const cell = (x, facing) => ({
    x,
    facing,
    antenna: { x: x + facing * 25 * s, y: baseY - 130 * s },
    ue: { x: phone.x - facing * (phone.width / 2 + 8), y: phone.y - 8 * s }
  });
  const left = isCore ? cell(w * 0.5, -1) : cell(w * 0.2, 1);
  const right = cell(w * 0.8, -1);
  // Wired transport from the cell site to the core node: the IMS is reached
  // through the RAN, never over the air. It starts under the mast.
  const wireY = baseY - 10 * s;
  const core = { x: right.x, entry: { x: right.x - 20 * s, y: wireY }, site: { x: left.x, y: wireY } };
  // Small core node behind each cell (`coreNodes`, e.g. each operator's AMF), on the outer side.
  const edgeCore = (c) => {
    const x = c.facing > 0 ? Math.max(c.x - 82 * s, 16 * s) : Math.min(c.x + 82 * s, w - 16 * s);
    return { x, entry: { x: x + c.facing * 13 * s, y: wireY }, site: { x: c.x, y: wireY } };
  };
  return { s, baseY, phone, left, right, core, edge: { left: edgeCore(left), right: edgeCore(right) } };
}

// Static network scene (two gNodeBs and the UE). Pure SVG: colours come from
// CSS custom properties, so it follows the theme without redrawing.
// `scene` is "failure" | "control" | "reference" and sets the target/UE colour.
// `rightKind` "core" draws the right node as a core-network server instead of a cell.
export function mountSceneView() {
  const svg = $("#scene-art");
  let mode = "failure";
  let rightKind = "ran";
  let cores = {};
  let lang = "";

  function draw() {
    const bounds = svg.getBoundingClientRect();
    const w = Math.max(bounds.width, 1);
    const h = Math.max(bounds.height, 1);
    const geo = sceneGeometry(w, h, rightKind);
    svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
    svg.setAttribute("class", `scene-art mode-${mode}`);

    const defs = svgEl("defs");
    const grid = svgEl("pattern", { id: "scene-grid", width: 38, height: 38, patternUnits: "userSpaceOnUse" });
    grid.append(svgEl("path", { d: "M 38 0 L 0 0 0 38", class: "scene-grid-line" }));
    defs.append(grid);

    svg.replaceChildren(
      defs,
      svgEl("rect", { width: w, height: h, class: "scene-bg" }),
      svgEl("rect", { width: w, height: h, fill: "url(#scene-grid)" }),
      svgEl("rect", { x: 0, y: geo.baseY, width: w, height: h - geo.baseY, class: "scene-ground" }),
      svgEl("line", { x1: 0, y1: geo.baseY, x2: w, y2: geo.baseY, class: "scene-horizon" }),
      link(geo.left, "serving"),
      ...(rightKind === "core"
        ? [backhaul(geo), gNodeB(geo, geo.left, "serving"), coreRack(geo.core.x, geo.baseY, geo.s, "target")]
        : [link(geo.right, "target"),
          ...["left", "right"].filter((side) => cores[side]).map((side) => edgeCore(geo, side, cores[side])),
          gNodeB(geo, geo.left, "serving"), gNodeB(geo, geo.right, "target")]),
      phone(geo)
    );
  }

  new ResizeObserver(draw).observe(svg);

  return function render(scene, kind = "ran", coreNodes = {}) {
    mode = scene;
    svg.setAttribute("class", `scene-art mode-${mode}`);
    const coresKey = JSON.stringify(coreNodes);
    if (!svg.childElementCount || kind !== rightKind || lang !== getLang() || coresKey !== JSON.stringify(cores)) {
      rightKind = kind;
      cores = coreNodes;
      lang = getLang();
      // The HTML labels and the event chip follow the layout (see .scene.layout-core).
      svg.closest(".scene").classList.toggle("layout-core", kind === "core");
      draw();
    }
  };
}

function backhaul(geo) {
  const { site, entry } = geo.core;
  const g = svgEl("g", { class: "scene-backhaul" });
  g.append(svgEl("line", { x1: site.x, y1: site.y, x2: entry.x, y2: entry.y, class: "backhaul-line" }));
  // Below the wire, so a signal travelling along it never covers the text.
  const label = svgEl("text", { x: (site.x + entry.x) / 2, y: site.y + 11, "text-anchor": "middle", class: "backhaul-label" });
  label.textContent = t("scene.backhaul");
  g.append(label);
  return g;
}

// A cell's own core node (e.g. AMF): short transport wire from the mast, a
// smaller rack and its name above it.
function edgeCore(geo, side, name) {
  const { x, site, entry } = geo.edge[side];
  const scale = geo.s * 0.6;
  const g = svgEl("g", { class: "scene-edge-core" });
  g.append(svgEl("line", { x1: site.x, y1: site.y, x2: entry.x, y2: entry.y, class: "backhaul-line" }));
  g.append(coreRack(x, geo.baseY, scale, side === "left" ? "serving" : "target"));
  const label = svgEl("text", { x, y: geo.baseY - 86 * scale - 6, "text-anchor": "middle", class: "core-label" });
  label.textContent = name;
  g.append(label);
  return g;
}

// Core-network node (e.g. IMS P-CSCF, AMF) drawn as a server rack: no antenna
// and no radio link, since the UE only reaches it through the RAN and transport.
function coreRack(x, baseY, scale, role) {
  const g = svgEl("g", { class: `scene-core ${role}`, transform: `translate(${x} ${baseY}) scale(${scale})` });
  const add = (name, attributes) => g.append(svgEl(name, attributes));
  add("ellipse", { cx: 0, cy: 1, rx: 34, ry: 4, class: "tower-shadow" });
  add("rect", { x: -20, y: -86, width: 40, height: 86, rx: 3, class: "core-rack" });
  for (let unit = 0; unit < 5; unit++) {
    const y = -80 + unit * 16;
    add("rect", { x: -15, y, width: 30, height: 12, rx: 1.5, class: "core-unit" });
    add("line", { x1: -11, y1: y + 6, x2: 4, y2: y + 6, class: "core-slot" });
    add("circle", { cx: 10, cy: y + 6, r: 1.8, class: `core-led${unit === 1 ? " blink" : ""}` });
  }
  return g;
}

function link(cell, role) {
  return svgEl("line", { x1: cell.antenna.x, y1: cell.antenna.y, x2: cell.ue.x, y2: cell.ue.y, class: `scene-link ${role}` });
}

// One gNodeB drawn in local units (origin at the foot, y up is negative,
// +x faces the UE) and placed with a single uniform scale, so it never stretches.
function gNodeB(geo, cell, role) {
  const g = svgEl("g", {
    class: `scene-tower ${role}`,
    transform: `translate(${cell.x} ${geo.baseY}) scale(${cell.facing * geo.s} ${geo.s})`
  });
  const add = (name, attributes) => g.append(svgEl(name, attributes));
  const line = (x1, y1, x2, y2, cls) => add("line", { x1, y1, x2, y2, class: cls });

  // Foundation and shadow.
  add("ellipse", { cx: 0, cy: 1, rx: 46, ry: 4, class: "tower-shadow" });
  add("rect", { x: -22, y: -4, width: 44, height: 5, rx: 1.5, class: "tower-footing" });

  // Lattice mast: tapered legs with X-bracing between levels.
  const top = -132;
  const half = (y) => 15 - 11 * (y / top);
  add("path", { d: `M ${-half(0)} 0 L ${-half(top)} ${top} M ${half(0)} 0 L ${half(top)} ${top}`, class: "tower-leg" });
  const levels = [0, -24, -46, -66, -84, -100, -116, top];
  levels.forEach((y, index) => {
    line(-half(y), y, half(y), y, "tower-brace");
    const next = levels[index + 1];
    if (next !== undefined) {
      line(-half(y), y, half(next), next, "tower-brace");
      line(half(y), y, -half(next), next, "tower-brace");
    }
  });

  // Feeder cables running from the cabinet up the mast.
  add("path", { d: "M 30 -24 L 30 -30 L 7 -30 L 4 -110", class: "tower-cable" });

  // Equipment cabinet (BBU / power) with a status LED.
  add("rect", { x: 22, y: -30, width: 22, height: 30, rx: 2, class: "tower-cabinet" });
  line(33, -27, 33, -3, "tower-cabinet-seam");
  add("circle", { cx: 39, cy: -24, r: 1.8, class: "tower-led" });

  // Microwave backhaul dish on the back of the mast.
  line(-6, -88, -12, -88, "tower-mount");
  add("ellipse", { cx: -15, cy: -88, rx: 3.5, ry: 8, class: "tower-dish" });

  // Antenna platform with railing.
  add("rect", { x: -26, y: -119, width: 52, height: 3.5, rx: 1, class: "tower-platform" });
  line(-26, -119, -26, -124, "tower-mount");
  line(26, -119, 26, -124, "tower-mount");

  // Three sector antennas on mounting pipes, each with a remote radio unit.
  for (const [x, width, depth] of [[-20, 7, "back"], [0, 6, "mid"], [20, 8, "front"]]) {
    line(x, -116, x, -146, "tower-mount");
    add("rect", { x: x - width / 2, y: -145, width, height: 30, rx: 2, class: `tower-antenna ${depth}` });
    line(x, -141, x, -119, "tower-antenna-rib");
    add("rect", { x: x - 3, y: -113, width: 6, height: 8, rx: 1, class: "tower-rru" });
  }

  // Lightning rod and aviation beacon.
  line(0, top, 0, -158, "tower-leg");
  add("circle", { cx: 0, cy: -160, r: 2.6, class: "tower-beacon" });

  // Radio waves leaving the front sector toward the UE.
  [12, 20, 28].forEach((radius, index) => {
    const angle = Math.PI / 5;
    const cx = 25;
    const cy = -130;
    add("path", {
      d: `M ${cx + radius * Math.cos(-angle)} ${cy + radius * Math.sin(-angle)} A ${radius} ${radius} 0 0 1 ${cx + radius * Math.cos(angle)} ${cy + radius * Math.sin(angle)}`,
      class: `tower-wave w${index + 1}`
    });
  });
  return g;
}

function phone(geo) {
  const { x, y, width, height } = geo.phone;
  const s = geo.s;
  const g = svgEl("g", { class: "scene-phone" });
  g.append(svgEl("rect", { x: x - width / 2, y: y - height / 2, width, height, rx: 6 * s, class: "phone-body" }));
  g.append(svgEl("rect", { x: x - width / 2 + 3 * s, y: y - height / 2 + 7 * s, width: width - 6 * s, height: height - 15 * s, rx: 2 * s, class: "phone-screen" }));
  g.append(svgEl("circle", { cx: x, cy: y - height / 2 + 3.6 * s, r: 1.6 * s, class: "phone-led" }));
  g.append(svgEl("line", { x1: x - 5 * s, y1: y + height / 2 - 4 * s, x2: x + 5 * s, y2: y + height / 2 - 4 * s, class: "phone-bar" }));
  return g;
}
