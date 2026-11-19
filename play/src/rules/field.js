import { pciOf, rsrpAt, siteConfig } from "./network.js";

// O mapa aproxima o enlace com o RSRP por distância e um piso efetivo fixo.
// O pareamento com o PCI/NR-ARFCN do caso só se aplica à RRU de referência.
const EFFECTIVE_FLOOR_DBM = -103;

function cellAt(network, [op, band], position, fixed) {
  const { sites, overrides, bands, criteria } = network;
  let strongest = null;
  for (const site of sites) {
    if (fixed && fixed.site !== site.id) continue;
    siteConfig(site, overrides).forEach(([operator, carrier], sector) => {
      if (operator !== op || carrier !== band || (fixed && fixed.sector !== sector)) return;
      const rsrp = rsrpAt(site, band, position.x, position.z, bands);
      if (strongest && rsrp <= strongest.rsrp) return;
      strongest = {
        op, band, site: site.id, sector, rsrp,
        pci: fixed ? criteria.pci : pciOf(sites, overrides, site, sector),
        ...(fixed ? { arfcn: criteria.arfcn, sinr: rsrp - EFFECTIVE_FLOOR_DBM } : {})
      };
    });
  }
  return strongest;
}

export function measurePoint(point, position, network, previous) {
  const { x, z, speed } = position;
  if (Math.hypot(x - point.x, z - point.z) > point.radius) return { error: "Aproxime-se do marcador para registrar este ponto." };
  if (point.maxSpeed !== undefined && Math.abs(speed) > point.maxSpeed) return { error: "Pare o veículo para medir o par Near-Cell." };

  const cells = point.cells.map((cell) => cellAt(network, cell, position, point.pairedCell));
  const missing = cells.findIndex((cell) => !cell);
  if (missing >= 0) {
    const [op, band] = point.cells[missing];
    const rack = point.pairedCell;
    const site = rack && network.sites.find(({ id }) => id === rack.site);
    return { error: "Configure " + op + " " + band +
      (site ? " na RRU " + (rack.sector + 1) + " do " + site.name + "." : " em um rack compatível.") };
  }
  if (point.preferred) {
    const preferred = cells.find(({ band }) => band === point.preferred);
    if (cells.some((cell) => cell !== preferred && cell.rsrp >= preferred.rsrp)) {
      return { error: "A " + point.preferred + " precisa predominar neste trecho. Confira a posição e a rede." };
    }
  }
  if (point.minDrop && (!previous || previous.cells[0].rsrp - cells[0].rsrp < point.minDrop)) {
    return { error: "Busque uma queda de pelo menos " + point.minDrop + " dB na n78 em relação ao início." };
  }

  if (point.pairedCell) {
    // Dois receptores lado a lado, com o carro parado no mesmo ponto.
    const cdut = cellAt(network, point.cells[0], { x: x + 0.5, z }, point.pairedCell);
    cells.push(cdut);
    const [dut, comparator] = cells;
    const { rsrpMin, sinrMin, rfDelta } = network.criteria;
    if (cells.some(({ rsrp, sinr }) => rsrp <= rsrpMin || sinr <= sinrMin)) {
      return { error: "RF fora da cobertura Near-Cell. Ajuste a posição e repita a medição." };
    }
    if (Math.abs(dut.rsrp - comparator.rsrp) > rfDelta || Math.abs(dut.sinr - comparator.sinr) > rfDelta) {
      return { error: "Diferença de RF acima da tolerância do par. Reposicione e repita." };
    }
  }
  return { label: point.label, x, z, paired: Boolean(point.pairedCell), cells };
}

export function validFieldSamples(plan, samples, network) {
  let index = 0;
  for (const point of plan.points) {
    const saved = samples[index];
    if (!saved) break;
    const current = measurePoint(point, { x: saved.x, z: saved.z, speed: 0 }, network, samples[index - 1]);
    if (current.error || current.cells.some((cell, i) => cell.site !== saved.cells[i].site || cell.sector !== saved.cells[i].sector)) break;
    index++;
  }
  return index;
}

export function fieldLine(sample) {
  const values = sample.cells.map((cell, i) => {
    const name = sample.paired ? (i === 0 ? "DUT" : "CDUT") : cell.band + " PCI " + cell.pci;
    return name + " " + cell.rsrp + " dBm" + (sample.paired ? " / " + cell.sinr + " dB" : "");
  });
  const identity = sample.paired ? " · PCI " + sample.cells[0].pci + " · ARFCN " + sample.cells[0].arfcn : "";
  return sample.label + identity + " · " + values.join(" · ");
}
