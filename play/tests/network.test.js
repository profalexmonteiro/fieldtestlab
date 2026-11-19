import { describe, expect, it } from "vitest";
import { NETWORK } from "../src/data/index.js";
import { bestCell, cellName, cellOn, missingCells, pciOf, rsrpAt, siteConfig, validSiteConfig } from "../src/rules/network.js";

const { sites, bands, operators, requiredCells } = NETWORK;
const site = (id) => sites.find((s) => s.id === id);

describe("configuração dos sites", () => {
  it("usa a configuração padrão quando o jogador não mexeu no rack", () => {
    expect(siteConfig(site("delta"), {})).toEqual(site("delta").def);
  });
  it("usa a configuração aplicada no rack e devolve uma cópia", () => {
    const ov = { delta: [["Zenith", "n41"], ["Zenith", "n41"], ["Zenith", "n41"]] };
    const cfg = siteConfig(site("delta"), ov);
    expect(cfg).toEqual(ov.delta);
    cfg[0][0] = "Aurora";
    expect(ov.delta[0][0]).toBe("Zenith");
  });
});

describe("células no ar", () => {
  it("encontra uma célula padrão e não inventa outra", () => {
    expect(cellOn(sites, {}, "NovaLink", "n78")).toBe(true);
    expect(cellOn(sites, {}, "Aurora", "n78")).toBe(false);
  });
  it("D2 começa sem Nimbus n78 e fica completo ao trocar a RRU 2 do Foxtrot para n78", () => {
    expect(missingCells(requiredCells["desafio-2"], sites, {}).map(cellName)).toEqual(["Nimbus n78"]);
    const ov = { fox: [["Vantis", "n78"], ["Nimbus", "n78"], ["Zenith", "n41"]] };
    expect(missingCells(requiredCells["desafio-2"], sites, ov)).toEqual([]);
  });
  it("aceita um rascunho ainda não aplicado (draft) sem alterar o save", () => {
    const draft = { site: site("fox"), cfg: [["Vantis", "n78"], ["Nimbus", "n78"], ["Zenith", "n41"]] };
    expect(missingCells(requiredCells["desafio-2"], sites, {}, draft)).toEqual([]);
    expect(missingCells(requiredCells["desafio-2"], sites, {})).toHaveLength(1);
  });
  it("D6 precisa de Aurora B3, que não existe na configuração padrão", () => {
    expect(missingCells(requiredCells["desafio-6"], sites, {}).map(cellName)).toContain("Aurora B3");
  });
});

describe("PCI e RSRP", () => {
  it("PCI é determinístico por site, setor e banda (n41 soma 57)", () => {
    expect(pciOf(sites, {}, site("delta"), 0)).toBe(80);
    expect(pciOf(sites, {}, site("delta"), 1)).toBe(80 + 8 + 57);
    expect(pciOf(sites, {}, site("echo"), 2)).toBe(80 + 40 + 16);
  });
  it("RSRP cai com a distância e bandas baixas propagam melhor", () => {
    const s = site("echo");
    expect(rsrpAt(s, "B3", s.x + 10, s.z, bands)).toBeGreaterThan(rsrpAt(s, "B3", s.x + 40, s.z, bands));
    expect(rsrpAt(s, "B28", s.x + 30, s.z, bands)).toBeGreaterThan(rsrpAt(s, "B3", s.x + 30, s.z, bands));
  });
  it("drive test perto do Site Delta: melhor célula NovaLink n41, PCI 145, −71 dBm", () => {
    const b = bestCell(sites, {}, bands, 6.4, -2.1);
    expect([b.site.id, b.op, b.band, b.pci, b.rsrp]).toEqual(["delta", "NovaLink", "n41", 145, -71]);
  });
});

describe("validação de configuração de rack", () => {
  it("aceita só 3 RRUs com operadora conhecida e banda suportada pelo site", () => {
    expect(validSiteConfig(site("delta"), site("delta").def, operators)).toBe(true);
    expect(validSiteConfig(site("delta"), [["NovaLink", "B3"], ["NovaLink", "n41"], ["Zenith", "n78"]], operators)).toBe(false);
    expect(validSiteConfig(site("delta"), [["Fantasma", "n78"], ["NovaLink", "n41"], ["Zenith", "n78"]], operators)).toBe(false);
    expect(validSiteConfig(site("delta"), [["NovaLink", "n78"]], operators)).toBe(false);
    expect(validSiteConfig(site("delta"), "lixo", operators)).toBe(false);
  });
});
