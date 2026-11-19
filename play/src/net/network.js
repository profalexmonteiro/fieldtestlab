import { save } from "../core/base.js";
import { NETWORK } from "../data/index.js";
import * as R from "../rules/network.js";
import throughput from "../../../data/desafio-7.json";

// ======================================================================
// Rede de acesso: operadoras, bandas e sites (dados em data/network.json; regras em rules/network.js).
// Aqui as regras são ligadas ao save do jogador (save.sites = configuração aplicada nos racks).
// ======================================================================
const { operators: OPERATORS, opColors: OP_COLORS, bands: BANDS, requiredCells: REQUIRED_CELLS } = NETWORK;
const SITES = NETWORK.sites.map((s) => ({ ...s }));          // cópias: o jogo pendura nelas os objetos 3D de cada site
const siteById = (id) => SITES.find((s) => s.id === id);
const siteCfg = (site) => R.siteConfig(site, save.sites);
const pciOf = (site, i) => R.pciOf(SITES, save.sites, site, i);
const cellOn = (op, band, draft) => R.cellOn(SITES, save.sites, op, band, draft);
const missingCells = (ch, draft) => R.missingCells(REQUIRED_CELLS[ch.id], SITES, save.sites, draft);
const bestCell = (x, z) => R.bestCell(SITES, save.sites, BANDS, x, z);
const fieldNetwork = () => ({ sites: SITES, overrides: save.sites, bands: BANDS, criteria: throughput.kpiTest.criteria });
const cellName = R.cellName;
const LAB = { minX: -9, maxX: 9, minZ: -24, maxZ: -8, h: 3.4 };

export { BANDS, LAB, OPERATORS, OP_COLORS, REQUIRED_CELLS, SITES, bestCell, cellName, cellOn, fieldNetwork, missingCells, pciOf, siteById, siteCfg };
