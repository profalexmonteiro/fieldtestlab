const observation = (metric) => ({ t: metric.observation });

export const captureLines = (scenario) => scenario.metrics.map(observation);

const decimal = (value) => value.toFixed(1).replace(".", ",").replace("-", "−");
const paired = (values) => values.map(decimal).join(" / ");
const cells = (shares) => Object.entries(shares)
  .map(([pci, percentage]) => percentage === 100 ? pci : pci + ":" + percentage + "%").join("+");

export function campaignPages({ criteria, iterations }) {
  const headers = [
    "DUT / CDUT em cada coluna · DL e UL em Mbps · células em PCI",
    "It    DL (Mbps)        UL (Mbps)      PCI DUT / CDUT          RSRP (dBm)       SINR (dB)"
  ];
  const rows = iterations.map((row) => [
    String(row.it).padStart(2),
    paired(row.dl).padEnd(15),
    paired(row.ul).padEnd(13),
    row.cells.map(cells).join(" / ").padEnd(22),
    paired(row.rsrp).padEnd(15),
    paired(row.sinr)
  ].join("    "));
  const pages = [];
  for (let index = 0; index < rows.length; index += 5) {
    pages.push([...headers, ...rows.slice(index, index + 5),
      "PCI " + criteria.pci + " · NR-ARFCN " + criteria.arfcn + " · RSRP > " + criteria.rsrpMin + " dBm · SINR > " + criteria.sinrMin + " dB · Δ RF ≤ " + criteria.rfDelta + " dB",
      "Sem RLF ou queda na campanha. PCI estável · mínimo " + criteria.minValid + " pares válidos.",
      "Critérios DL e UL: |Δ média| < " + criteria.meanPct + "% e |Δ desvio amostral| < " + criteria.sigmaPct + "%."
    ].map((t) => ({ t })));
  }
  return pages;
}
