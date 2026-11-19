// Desenho dos avatares do engenheiro em SVG, a partir da especificação em data/avatars.json.
import { AVATARS } from "../data/index.js";

function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const c = (v) => Math.max(0, Math.min(255, v + amt));
  const r = c(n >> 16), g = c((n >> 8) & 255), b = c(n & 255);
  return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}

function svg(a, size) {
  const s = size || 96;
  const o = a.outfitColor, od = shade(o, -40);
  let body = "";
  if (a.outfit === "coat") {
    body = `<path d="M18 120 Q20 86 60 82 Q100 86 102 120Z" fill="${o}" stroke="#C9D1DD" stroke-width="1.5"/>
      <path d="M52 84 L60 100 L68 84" fill="#2F63C9"/><path d="M60 100 L60 120" stroke="#C9D1DD" stroke-width="1.5"/>
      <path d="M44 86 L56 112 M76 86 L64 112" stroke="#C9D1DD" stroke-width="1.5" fill="none"/>`;
  } else if (a.outfit === "vest") {
    body = `<path d="M18 120 Q20 86 60 82 Q100 86 102 120Z" fill="#46566E"/>
      <path d="M30 120 L34 90 Q46 84 52 86 L56 120Z M90 120 L86 90 Q74 84 68 86 L64 120Z" fill="${o}"/>
      <path d="M33 104 L55 104 M87 104 L65 104" stroke="#F4F6F9" stroke-width="4"/>`;
  } else if (a.outfit === "hoodie") {
    body = `<path d="M18 120 Q20 86 60 82 Q100 86 102 120Z" fill="${o}"/>
      <path d="M42 84 Q60 100 78 84" fill="none" stroke="${shade(o, 40)}" stroke-width="4"/>
      <path d="M54 96 L52 112 M66 96 L68 112" stroke="#F4F6F9" stroke-width="2"/>`;
  } else {
    body = `<path d="M18 120 Q20 86 60 82 Q100 86 102 120Z" fill="${o}"/>
      <path d="M50 84 L60 104 L70 84Z" fill="#FFFFFF"/><path d="M58 90 L62 90 L63 108 L60 112 L57 108Z" fill="#FF6B00"/>
      <path d="M46 86 L60 104 L74 86" fill="none" stroke="${od}" stroke-width="2"/>`;
  }
  const neck = `<rect x="53" y="70" width="14" height="16" rx="5" fill="${shade(a.skin, -18)}"/>`;
  const head = `<ellipse cx="60" cy="52" rx="22" ry="25" fill="${a.skin}"/>
    <ellipse cx="38" cy="54" rx="4" ry="6" fill="${shade(a.skin, -12)}"/><ellipse cx="82" cy="54" rx="4" ry="6" fill="${shade(a.skin, -12)}"/>`;
  const face = `<circle cx="51" cy="53" r="2.6" fill="#0A192F"/><circle cx="69" cy="53" r="2.6" fill="#0A192F"/>
    <path d="M52 64 Q60 70 68 64" stroke="#0A192F" stroke-width="2.4" fill="none" stroke-linecap="round"/>
    <path d="M46 46 Q51 43 56 46 M64 46 Q69 43 74 46" stroke="${a.hair === "none" ? shade(a.skin, -60) : a.hairColor}" stroke-width="2.2" fill="none" stroke-linecap="round"/>`;
  const hc = a.hairColor;
  let hairBack = "", hairFront = "";
  if (a.hair === "short") hairFront = `<path d="M38 50 Q36 26 60 25 Q84 26 82 50 Q78 36 60 36 Q44 36 38 50Z" fill="${hc}"/>`;
  if (a.hair === "long") { hairBack = `<path d="M34 52 Q32 22 60 22 Q88 22 86 52 L88 88 Q74 80 74 70 L46 70 Q46 80 32 88Z" fill="${hc}"/>`; hairFront = `<path d="M38 50 Q38 28 60 27 Q82 28 82 50 Q74 34 58 36 Q46 38 38 50Z" fill="${hc}"/>`; }
  if (a.hair === "curly") hairFront = `<g fill="${hc}"><circle cx="42" cy="38" r="9"/><circle cx="52" cy="30" r="10"/><circle cx="66" cy="29" r="10"/><circle cx="78" cy="37" r="9"/><circle cx="38" cy="48" r="6"/><circle cx="82" cy="48" r="6"/></g>`;
  if (a.hair === "bun") hairFront = `<circle cx="60" cy="20" r="10" fill="${hc}"/><path d="M38 50 Q36 26 60 26 Q84 26 82 50 Q76 34 60 34 Q44 34 38 50Z" fill="${hc}"/>`;

  let hat = "";
  const hcol = a.hatColor || "#FFC21A";
  if (a.hat === "helmet") hat = `<path d="M34 44 Q34 18 60 18 Q86 18 86 44Z" fill="${hcol}"/><rect x="30" y="42" width="60" height="6" rx="3" fill="${shade(hcol, -30)}"/><rect x="56" y="18" width="8" height="25" rx="3" fill="${shade(hcol, 25)}"/>`;
  if (a.hat === "cap") hat = `<path d="M36 42 Q36 22 60 22 Q84 22 84 42Z" fill="${hcol}"/><path d="M60 40 L96 44 Q90 48 60 46Z" fill="${shade(hcol, 30)}"/>`;
  if (a.hat === "headset") hat = `<path d="M36 52 Q36 22 60 22 Q84 22 84 52" fill="none" stroke="#0A192F" stroke-width="4"/><rect x="31" y="46" width="9" height="16" rx="4" fill="#0A192F"/><rect x="80" y="46" width="9" height="16" rx="4" fill="#0A192F"/><path d="M36 62 Q38 72 50 70" fill="none" stroke="#0A192F" stroke-width="2.5"/><circle cx="51" cy="70" r="3" fill="#FF6B00"/>`;
  if (a.hat === "visor") hat = `<rect x="38" y="46" width="44" height="12" rx="6" fill="${hcol}" opacity="0.85"/><path d="M38 52 L34 50 M82 52 L86 50" stroke="#0A192F" stroke-width="3"/>`;
  if (a.hat === "crown") hat = `<path d="M40 30 L44 14 L52 24 L60 10 L68 24 L76 14 L80 30Z" fill="${hcol}" stroke="${shade(hcol, -50)}" stroke-width="1.5"/><circle cx="60" cy="22" r="2.5" fill="#C63B3B"/>`;

  let acc = "";
  if (a.acc === "glasses") acc = `<g fill="none" stroke="#0A192F" stroke-width="2.2"><rect x="43" y="47" width="14" height="11" rx="4"/><rect x="63" y="47" width="14" height="11" rx="4"/><path d="M57 52 L63 52"/></g>`;
  if (a.acc === "badge") acc = `<rect x="70" y="96" width="16" height="20" rx="2" fill="#FFFFFF" stroke="#FF6B00" stroke-width="2"/><rect x="73" y="100" width="10" height="5" fill="#FF6B00"/><path d="M73 109 L83 109 M73 112 L80 112" stroke="#46566E" stroke-width="1.5"/>`;
  if (a.acc === "phone") acc = `<rect x="84" y="88" width="14" height="24" rx="3" fill="#0A192F"/><rect x="86" y="91" width="10" height="16" rx="1" fill="#6FD3FF"/><path d="M88 99 l2 -3 l2 2 l3 -4" stroke="#FF6B00" stroke-width="1.5" fill="none"/>`;
  if (a.acc === "antenna") acc = `<path d="M92 120 L92 80" stroke="#46566E" stroke-width="3"/><circle cx="92" cy="78" r="3.5" fill="#FF6B00"/><path d="M84 72 Q92 64 100 72 M80 66 Q92 54 104 66" stroke="#FF6B00" stroke-width="2" fill="none"/>`;

  const glow = a.glow ? `<circle cx="60" cy="60" r="57" fill="none" stroke="#FFC21A" stroke-width="4"/><circle cx="60" cy="60" r="52" fill="none" stroke="#FFE7A0" stroke-width="1" stroke-dasharray="3 5"/>` : "";
  return `<svg viewBox="0 0 120 120" width="${s}" height="${s}" role="img" aria-label="${a.name}" xmlns="http://www.w3.org/2000/svg">
    <defs><clipPath id="c-${a.id}-${s}"><circle cx="60" cy="60" r="58"/></clipPath></defs>
    <circle cx="60" cy="60" r="58" fill="${a.bg}"/>
    <g clip-path="url(#c-${a.id}-${s})">${hairBack}${body}${neck}${head}${hairFront}${face}${hat}${acc}</g>${glow}</svg>`;
}

export const avatarSpec = (id) => AVATARS.find((a) => a.id === id) || AVATARS[0];
export const avatarSvg = (id, size) => svg(avatarSpec(id), size);
