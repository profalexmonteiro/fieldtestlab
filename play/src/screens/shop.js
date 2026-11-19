import { hud, persist, save, toast } from "../core/base.js";
import { UI, paint, setScreen } from "../ui/screens.js";
import { world } from "../world/world.js";
import { rebuildPlayer } from "../world/characters.js";
import { setMode } from "../game/modes.js";
import { AVATARS } from "../data/index.js";
import { avatarSvg } from "../ui/avatarSvg.js";
import { registerMode, registerStation } from "../game/registry.js";
import { mode } from "../game/state.js";

const avatarImgs = {};
function avatarImg(id) {
  if (!avatarImgs[id]) {
    const img = new Image(); img.onload = () => { if (mode === "shop") paint(world.shop); };
    img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(avatarSvg(id, 200));
    avatarImgs[id] = img;
  }
  return avatarImgs[id];
}
function openShop() {
  setScreen(world.shop, (s) => {
    const k = s.k, W = s.W, x = s.x;
    UI.bg(s, "#F4F6F9"); UI.header(s, `Provador · uniformes   🪙 ${save.coins}`);
    AVATARS.forEach((a, i) => {
      const cw = (W - 24 * k * 2 - 4 * 14 * k) / 5, ch = 268 * k, cx = 24 * k + (i % 5) * (cw + 14 * k), cy = 78 * k + Math.floor(i / 5) * (ch + 12 * k);
      const owned = save.owned.includes(a.id), eq = save.avatar === a.id;
      UI.card(s, cx, cy, cw, ch, "#FFFFFF", eq ? "#FF6B00" : "#C9D1DD");
      const img = avatarImg(a.id); if (img.complete && img.naturalWidth) x.drawImage(img, cx + cw / 2 - 58 * k, cy + 8 * k, 116 * k, 116 * k);
      UI.text(s, a.name, cx + cw / 2, cy + 128 * k, { size: 19, weight: "bold", align: "center", maxW: cw - 12 * k, maxLines: 2 });
      UI.text(s, a.rarity, cx + cw / 2, cy + 176 * k, { size: 17, color: "#7a3fd1", align: "center" });
      const label = eq ? "✔ Vestido" : owned ? "Vestir" : `🪙 ${a.price}`;
      const can = !eq && (owned || save.coins >= a.price);
      UI.btn(s, cx + 10 * k, cy + ch - 62 * k, cw - 20 * k, 50 * k, label, () => buyOrWear(a), { kind: eq ? "ok" : can ? (owned ? "ghost" : "primary") : "dim", center: true, size: 20, disabled: !can });
    });
    UI.btn(s, W - 196 * k, 6 * k, 180 * k, 52 * k, "Voltar ✕", () => setMode("free"), { kind: "dark", center: true, key: "Escape", size: 22 });
  });
  setMode("shop");
}
function buyOrWear(a) {
  if (!save.owned.includes(a.id)) { if (save.coins < a.price) return; save.coins -= a.price; save.owned.push(a.id); toast("Novo uniforme: " + a.name, "good"); }
  save.avatar = a.id; persist(); rebuildPlayer(); hud(); paint(world.shop);
}

// estação e modo deste módulo (game/registry.js)
registerStation("shop", { label: () => "Provador · trocar uniforme", open: openShop });
registerMode("shop", { escape: () => setMode("free") });
