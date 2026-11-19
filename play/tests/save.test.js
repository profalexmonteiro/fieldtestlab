import { describe, expect, it } from "vitest";
import { AVATARS, NETWORK } from "../src/data/index.js";
import { SAVE_VERSION, blankSave, migrateSave } from "../src/rules/save.js";

const ctx = { sites: NETWORK.sites, operators: NETWORK.operators, avatars: AVATARS };

describe("migração do save", () => {
  it("save v1 (sem versão) mantém progresso, moedas e uniformes e ganha v2", () => {
    const v1 = { name: "Alex", coins: 120, xp: 400, owned: ["estagio", "rf"], avatar: "rf", progress: { "desafio-2": { completed: true, best: 250, runs: 1, stars: 3 } } };
    const s = migrateSave(v1, ctx);
    expect(s.v).toBe(SAVE_VERSION);
    expect(s).toMatchObject({ name: "Alex", coins: 120, xp: 400, avatar: "rf", progress: v1.progress });
    expect(s.owned).toEqual(["estagio", "rf"]);
    expect(s.sites).toEqual({});
  });
  it("mantém racks válidos e descarta configurações inválidas ou de sites inexistentes", () => {
    const s = migrateSave({ sites: {
      fox: [["Vantis", "n78"], ["Nimbus", "n78"], ["Zenith", "n41"]],
      delta: [["NovaLink", "GSM900"], ["NovaLink", "n41"], ["Zenith", "n78"]],
      marte: [["Zenith", "n78"], ["Zenith", "n78"], ["Zenith", "n78"]]
    } }, ctx);
    expect(Object.keys(s.sites)).toEqual(["fox"]);
  });
  it("garante o uniforme inicial e volta ao inicial se o avatar não for do jogador", () => {
    const s = migrateSave({ owned: ["rf", "inexistente"], avatar: "lenda" }, ctx);
    expect(s.owned).toEqual(["estagio", "rf"]);
    expect(s.avatar).toBe("estagio");
  });
  it("corrige números inválidos e nome longo", () => {
    const s = migrateSave({ coins: -50, xp: "muito", name: "x".repeat(40) }, ctx);
    expect([s.coins, s.xp, s.name.length]).toEqual([0, 0, 24]);
  });
  it("lixo vira um save novo; save de versão futura não é tocado", () => {
    expect(migrateSave(null, ctx)).toEqual(blankSave());
    expect(migrateSave([1, 2], ctx)).toEqual(blankSave());
    expect(migrateSave({ v: SAVE_VERSION + 1, coins: -1 }, ctx).coins).toBe(-1);
  });
  it("migrar duas vezes dá o mesmo resultado", () => {
    const once = migrateSave({ name: "Alex", coins: 10, sites: { fox: [["Vantis", "n78"], ["Nimbus", "n78"], ["Zenith", "n41"]] } }, ctx);
    expect(migrateSave(once, ctx)).toEqual(once);
  });
});
