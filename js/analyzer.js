import { t, getLang } from "./i18n.js";

// Classifies each event once, when the log is loaded. Rules look only at the
// message name and its one-line summary, never at the full decode: decodes
// carry incidental words (e.g. "Purpose : RLF", "rlf-TimersAndConstants",
// "prach-ConfigIndex") that would mislabel unrelated messages.
// Rules are checked in order; the first match wins. The one exception is
// kpiDetail(), which reads named fields of a few trace and RRC records.
const OUT_OF_SYNC_BLER = 10; // Qout: 10 % filtered BLER (Outsync_Threshold in 0xB959)

const RULES = [
  { when: (m) => /Registration Reject|Attach Reject/i.test(m.msg), tone: "bad-text",
    label: (m) => m.summary.match(/(?:5GMM-)?Cause\s*#?\s*\d+(?:\s*"[^"]*")?/i)?.[0] || t("proc.nasReject") },
  { when: (m) => /Radio Link Failure Declared/i.test(m.msg), tone: "bad-text",
    label: (m) => t("proc.rlf", { cause: m.summary.match(/cause:\s*(\S+)/i)?.[1] || "RLF" }) },
  { when: (m) => /Re-establishment Procedure Started/i.test(m.msg), tone: "warn-text", label: () => t("proc.reestStarted") },
  { when: (m) => /RRC Connection Re-establishment Failure/i.test(m.msg), tone: "bad-text", label: () => t("proc.reestFailed") },
  { when: (m) => /Voice Call Dropped/i.test(m.msg), tone: "bad-text", label: () => t("proc.callDropped") },
  { when: (m) => /Out-of-Sync Indications/i.test(m.msg), tone: "warn-text", label: () => t("proc.t310Started") },
  { when: (m) => /^paging$/i.test(m.msg), tone: "accent-text", label: () => t("proc.paging") },
  // Emergency call (112): network selection, emergency sessions, CSFB to the CS domain.
  { when: (m) => /^Emergency Dial$/i.test(m.msg), tone: "accent-text", label: () => t("proc.emergencyDial") },
  { when: (m) => /Emergency Call Established/i.test(m.msg), tone: "good-text",
    label: (m) => t("proc.emergencyEstablished", {
      via: m.summary.match(/via\s+([A-Za-z]+)/i)?.[1] || "",
      plmn: m.summary.match(/PLMN\s*(\d{3}\/\d{2,3})/i)?.[1] || ""
    }) },
  { when: (m) => /^DL NAS transport$/i.test(m.msg) && /5GMM cause/i.test(m.summary), tone: "bad-text",
    label: (m) => m.summary.match(/5GMM cause\s*\d+(?:\s*\([^)]*\))?/i)[0] },
  { when: (m) => /Network Redirect Check/i.test(m.msg) && /\bno\b/i.test(m.summary), tone: "warn-text", label: () => t("proc.noRedirect") },
  { when: (m) => /PDU Session Failure Handling/i.test(m.msg), tone: "warn-text",
    label: (m) => t("proc.pduFailure", { action: m.summary.match(/next action:\s*(.+)$/i)?.[1] || "" }) },
  { when: (m) => /Band Scan Started/i.test(m.msg), tone: "warn-text", label: () => t("proc.bandScan") },
  { when: (m) => /Band Scan Result/i.test(m.msg), tone: "", label: () => t("proc.bandScanResult") },
  { when: (m) => /Cell Selection Decision|^LTE Cell Selection$/i.test(m.msg), tone: "accent-text",
    label: (m) => t("proc.cellSelected", { plmn: m.summary.match(/PLMN\s*(\d{3}\/\d{2,3})/i)?.[1] || "" }) },
  { when: (m) => /^Attach request$/i.test(m.msg) && /emergency/i.test(m.summary), tone: "warn-text", label: () => t("proc.emergencyAttach") },
  { when: (m) => /^PDN connectivity request$/i.test(m.msg) && /emergency/i.test(m.summary), tone: "accent-text", label: () => t("proc.emergencyPdn") },
  { when: (m) => /^Activate default EPS bearer context (request|accept)$/i.test(m.msg) && /APN sos/i.test(m.summary), tone: "accent-text", label: () => t("proc.sosBearer") },
  { when: (m) => /^PDU session establishment request$/i.test(m.msg) && /emergency/i.test(m.summary), tone: "accent-text", label: () => t("proc.emergencyPdu") },
  { when: (m) => /^Service request$/i.test(m.msg), tone: "accent-text",
    label: (m) => t(/emergency/i.test(m.summary) ? "proc.serviceRequestEmergency" : "proc.serviceRequest") },
  { when: (m) => /^Service accept$/i.test(m.msg), tone: "good-text", label: () => t("proc.serviceAccept") },
  { when: (m) => /IMS Emergency Registration Failed/i.test(m.msg), tone: "bad-text", label: () => t("proc.imsEmergencyRefused") },
  { when: (m) => /^Extended service request$/i.test(m.msg) && /CS fallback/i.test(m.summary), tone: "warn-text", label: () => t("proc.csfbEmergency") },
  { when: (m) => /^rrcConnectionRelease$/i.test(m.msg) && /redirectedCarrierInfo.*geran/i.test(m.summary), tone: "warn-text", label: () => t("proc.redirectGeran") },
  { when: (m) => /GERAN Cell Access/i.test(m.msg), tone: "accent-text", label: () => t("proc.geranAccess") },
  { when: (m) => /^CM Service Request$/i.test(m.msg), tone: "accent-text", label: () => t("proc.cmService") },
  { when: (m) => /^Emergency Setup$/i.test(m.msg), tone: "accent-text", label: () => t("proc.emergencySetup") },
  { when: (m) => /^Alerting$/i.test(m.msg), tone: "good-text", label: () => t("proc.ringing") },
  { when: (m) => /^Connect$/i.test(m.msg), tone: "good-text", label: () => t("proc.csConnect") },
  // Throughput KPI test: iperf3 session, test harness and L1/MAC trace records.
  // The trace records are refined field by field in kpiDetail().
  { when: (m) => /^Test Run Start$/i.test(m.msg), tone: "accent-text",
    label: (m) => t("proc.testRunStart", { it: m.summary.match(/(\d+\s*\/\s*\d+)/)?.[1] || "" }) },
  { when: (m) => /^Test Run End$/i.test(m.msg), tone: "", label: () => t("proc.testRunEnd") },
  { when: (m) => /^iPerf3 Session Start$/i.test(m.msg), tone: "accent-text", label: () => t("proc.iperfStart") },
  { when: (m) => /^iPerf3 Session End$/i.test(m.msg), tone: "good-text", label: (m) => t("proc.iperfEnd", throughputParams(m.summary)) },
  { when: (m) => /^Throughput Sample$/i.test(m.msg), tone: "", label: (m) => t("proc.tputSample", throughputParams(m.summary)) },
  { when: (m) => /^Radio Snapshot$/i.test(m.msg), tone: "", label: (m) => t("proc.radioSnapshot", radioParams(m.summary)) },
  { when: (m) => /^Modem Counters Reset$/i.test(m.msg), tone: "", label: () => t("proc.countersReset") },
  { when: (m) => /^Modem Counters Snapshot$/i.test(m.msg), tone: "", label: () => t("proc.countersSnapshot") },
  { when: (m) => /^Data Session Up$/i.test(m.msg), tone: "good-text", label: () => t("proc.dataSessionUp") },
  { when: (m) => /0xB887\]/i.test(m.msg), tone: "", label: () => t("proc.pdschStatus") },
  { when: (m) => /0xB888\]/i.test(m.msg), tone: "", label: () => t("proc.pdschStats") },
  { when: (m) => /0xB8A7\]/i.test(m.msg), tone: "", label: () => t("proc.csiReport") },
  { when: (m) => /0xB8D8\]/i.test(m.msg), tone: "", label: () => t("proc.servingSnr") },
  { when: (m) => /0xB885\]/i.test(m.msg), tone: "", label: () => t("proc.ulGrants") },
  { when: (m) => /0xB883\]/i.test(m.msg), tone: "", label: () => t("proc.puschReport") },
  { when: (m) => /0xB872\]/i.test(m.msg), tone: "", label: () => t("proc.ulTb") },
  { when: (m) => /0xB884\]/i.test(m.msg), tone: "", label: () => t("proc.puschPower") },
  { when: (m) => /^UECapability(Enquiry|Information)$/i.test(m.msg), tone: "accent-text", label: () => t("proc.ueCapability") },
  // EPS Fallback and SRVCC (voice continuity).
  { when: (m) => /^RRCRelease$/i.test(m.msg) && /redirectedCarrierInfo.*eutra/i.test(m.summary), tone: "accent-text", label: () => t("proc.epsFallback") },
  { when: (m) => /^mobilityFromEUTRACommand$/i.test(m.msg), tone: "good-text", label: () => t("proc.srvccCommand") },
  { when: (m) => /SRVCC Handover to GERAN Started/i.test(m.msg), tone: "accent-text", label: () => t("proc.srvccStarted") },
  { when: (m) => /^Handover Complete \(RR\)$/i.test(m.msg), tone: "good-text", label: () => t("proc.srvccComplete") },
  { when: (m) => /^Tracking area update (request|complete)$/i.test(m.msg), tone: "accent-text", label: () => t("proc.tau") },
  { when: (m) => /^Tracking area update accept$/i.test(m.msg), tone: "good-text", label: () => t("proc.tauAccepted") },
  { when: (m) => /^Activate dedicated EPS bearer context request$/i.test(m.msg),
    tone: (m) => /retransmission/i.test(m.summary) ? "warn-text" : "accent-text",
    label: (m) => t(/retransmission/i.test(m.summary) ? "proc.bearerRetransmission" : "proc.bearerRequest") },
  { when: (m) => /^Activate dedicated EPS bearer context accept$/i.test(m.msg), tone: "accent-text",
    label: (m) => t("proc.bearerAccept", { ebi: m.summary.match(/EBI\s*(\d+)/i)?.[1] || "?" }) },
  { when: (m) => /^RRCReestablishmentComplete$/i.test(m.msg), tone: "good-text", label: () => t("proc.restored") },
  { when: (m) => /^RRCReestablishment(Request)?$/i.test(m.msg), tone: "warn-text", label: () => t("proc.reestablishment") },
  { when: (m) => /^Service Restored$/i.test(m.msg), tone: "good-text", label: () => t("proc.serviceRestored") },
  { when: (m) => /HO_SUCCESS/i.test(m.msg) || (/^RRCReconfigurationComplete$/i.test(m.msg) && /handover complete/i.test(m.summary)),
    tone: "good-text", label: () => t("proc.handover") },
  { when: (m) => /HO_STARTED/i.test(m.msg), tone: "accent-text", label: () => t("proc.hoStarted") },
  { when: (m) => /^RRCReconfiguration$/i.test(m.msg) && /reconfigurationWithSync|Handover Command/i.test(m.summary),
    tone: "accent-text", label: () => t("proc.hoCommand") },
  { when: (m) => /^RRCReconfiguration$/i.test(m.msg) && /measConfig \[MO#?\d|measId=\d+ event/i.test(m.summary) && !/restore/i.test(m.summary),
    tone: "accent-text", label: () => t("proc.measConfig") },
  { when: (m) => /^RRCReconfiguration$/i.test(m.msg), tone: "accent-text", label: () => t("proc.rrcReconfig") },
  { when: (m) => /^RRCReconfigurationComplete$/i.test(m.msg), tone: "accent-text", label: () => t("proc.rrcReconfigComplete") },
  { when: (m) => /^Measurement ?Report$/i.test(m.msg), tone: "accent-text",
    label: (m) => {
      const id = m.summary.match(/measId\s*=\s*(\d+)/i)?.[1];
      return id ? t("proc.measurementId", { id }) : t("proc.measurement");
    } },
  { when: (m) => /RLM Stats/i.test(m.msg),
    tone: (m) => rlmOutOfSync(m) ? "warn-text" : "good-text",
    label: (m) => t(rlmOutOfSync(m) ? "proc.rlmOos" : "proc.rlmOk") },
  { when: (m) => /S Criteria/i.test(m.msg),
    tone: (m) => /FAILURE/i.test(m.summary) ? "bad-text" : "good-text",
    label: (m) => t(/FAILURE/i.test(m.summary) ? "proc.sFail" : "proc.sOk") },
  { when: (m) => /RACH Attempt/i.test(m.msg) && /FAILURE/i.test(m.summary), tone: "bad-text", label: () => t("proc.rachFail") },
  { when: (m) => /RACH Attempt|RACH_RESULT/i.test(m.msg) && /SUCCESS/i.test(m.summary), tone: "good-text", label: () => t("proc.rachOk") },
  { when: (m) => /PRACH attempt\s*\d+/i.test(m.summary), tone: "warn-text",
    label: (m) => t("proc.msg1", { n: m.summary.match(/PRACH attempt\s*(\d+)/i)[1] }) },
  { when: (m) => /RACH Trigger|RACH_START/i.test(m.msg), tone: "warn-text", label: () => t("proc.rach") },
  // IMS / SIP: responses are named by their status line ("401 Unauthorized").
  { when: (m) => /^401\b/.test(m.msg), tone: "accent-text", label: () => t("proc.sipChallenge") },
  { when: (m) => /^[456]\d\d\b/.test(m.msg), tone: "bad-text", label: (m) => t("proc.sipError", { status: m.msg }) },
  { when: (m) => /IMS Registration Failure/i.test(m.msg), tone: "bad-text", label: () => t("proc.imsFailed") },
  { when: (m) => /Voice Domain Selection/i.test(m.msg) && /unavailable/i.test(m.summary), tone: "bad-text", label: () => t("proc.noVoice") },
  { when: (m) => (/^200 OK$/i.test(m.msg) && /registration (complete|accepted)/i.test(m.summary))
      || (/IMS Registration State/i.test(m.msg) && /\bREGISTERED\b/.test(m.summary)),
    tone: "good-text", label: () => t("proc.imsRegistered") },
  { when: (m) => /^REGISTER$/i.test(m.msg), tone: "accent-text", label: () => t("proc.imsRegister") },
  { when: (m) => /Authorization Build/i.test(m.msg) && /CACHED/.test(m.summary), tone: "warn-text", label: () => t("proc.nonceCached") },
  { when: (m) => /^INVITE$/i.test(m.msg), tone: "accent-text", label: () => t("proc.invite") },
  { when: (m) => /^180 Ringing$|^Incoming Call$/i.test(m.msg), tone: "good-text", label: () => t("proc.ringing") },
  { when: (m) => /^200 OK$/i.test(m.msg) && /call (answered|established)/i.test(m.summary), tone: "good-text", label: () => t("proc.answered") },
  { when: (m) => /^Vocoder Started( \(CS\))?$/i.test(m.msg), tone: "accent-text", label: (m) => t("proc.vocoder", { codec: m.summary }) },
  { when: (m) => /RTP\/RTCP Statistics/i.test(m.msg), tone: "", label: () => t("proc.rtpStats") },
  { when: (m) => /Deregistration request|Detach request/i.test(m.msg), tone: "warn-text", label: () => t("proc.deregistration") },
  { when: (m) => /Registration Accept|Attach Accept/i.test(m.msg), tone: "good-text", label: () => t("proc.accepted") },
  { when: (m) => /Registration Complete|Attach Complete/i.test(m.msg), tone: "good-text", label: () => t("proc.registered") },
  { when: (m) => /Registration Request|Attach Request/i.test(m.msg), tone: "accent-text", label: () => t("proc.registrationRequest") },
  { when: (m) => /^Authentication (Request|Response)$/i.test(m.msg), tone: "accent-text", label: () => t("proc.auth") },
  { when: (m) => /^Security ?Mode ?(Command|Complete)$/i.test(m.msg), tone: "accent-text", label: () => t("proc.security") },
  { when: (m) => /PDU session establishment/i.test(m.msg), tone: "accent-text", label: () => t("proc.pduSession") },
  { when: (m) => /^RRCSetup(Request|Complete)?$|^rrcConnection(Request|Setup|SetupComplete)$/i.test(m.msg), tone: "accent-text", label: () => t("proc.rrc") },
  { when: (m) => /^RRCRelease$|^rrcConnectionRelease$/i.test(m.msg), tone: "warn-text", label: () => t("proc.rrcRelease") },
  { when: (m) => /^(MIB|MasterInformationBlock|SIB\d+|systemInformationBlockType\d+)$/i.test(m.msg), tone: "", label: () => t("proc.sysInfo") },
  { when: (m) => /Measurement Database Update/i.test(m.msg), tone: "", label: () => t("proc.l1Measurement") },
  { when: (m) => /ACQ Config|PSS\/SSS/i.test(m.msg), tone: "", label: () => t("proc.cellSearch") }
];

const number = (value, digits = 1) => Number(value).toLocaleString(getLang(), { minimumFractionDigits: digits, maximumFractionDigits: digits });

// "[ 1s] DL 575.9 Mbps | UL 38.6 Mbps" → localized DL/UL values.
function throughputParams(summary) {
  const dl = summary.match(/DL\s*([\d.]+)\s*Mbps/i)?.[1];
  const ul = summary.match(/UL\s*([\d.]+)\s*Mbps/i)?.[1];
  return { dl: dl ? number(dl) : "—", ul: ul ? number(ul) : "—" };
}

// "SS-RSRP -78.6 dBm | SS-SINR 24.5 dB | PCI 214" → localized values.
function radioParams(summary) {
  const rsrp = summary.match(/RSRP\s*(-?[\d.]+)/i)?.[1];
  const sinr = summary.match(/SINR\s*(-?[\d.]+)/i)?.[1];
  return {
    rsrp: rsrp ? number(rsrp).replace("-", "−") : "—",
    sinr: sinr ? number(sinr) : "—",
    pci: summary.match(/PCI\s*(\d+)/i)?.[1] || "—"
  };
}

const LAYERS = { oneLayer: 1, twoLayers: 2, fourLayers: 4, eightLayers: 8 };

// A nonzero RV identifies the retransmission grants in these captured batches.
// RV alone is not a general test for new data, since a retransmission can use RV 0.
const ulGrants = (full) => [...full.matchAll(/UL_0_[01]\s+\S+\s+[01]\s+(\d+)\s+(\d+)\s+(\d+)/g)]
  .map(([, mcs, rv, harqId]) => ({ mcs, rv, harqId }));

const puschRecords = (full) => [...full.matchAll(/harq_id\s*:\s*(\d+)\s+mcs\s*:\s*(\d+)[^[]*?l2_new_tb\s*:\s*(TRUE|FALSE)[^[]*?rv_index\s*:\s*(\d+)\s+tx_type\s*:\s*(RE_TX|NEW_TX)/g)]
  .map(([, harqId, mcs, newTb, rv, type]) => ({ harqId, mcs, newTb, rv, type }));

// Throughput traces: what matters is inside the decode (the summary only says
// "num_records 12"), so these records are read field by field. Each check is
// tied to a known message and field. Compare matching DCI/PUSCH batches
// captured close together. A CSI report can appear between them.
function kpiDetail(event, base, preceding) {
  const msg = String(event.msg || "");
  const full = String(event.full || "");
  if (/^UECapabilityInformation$/i.test(msg)) {
    const layers = LAYERS[full.match(/maxNumberMIMO[_-]LayersPDSCH\s*=\s*(\w+)/i)?.[1]];
    if (layers) return { procedure: t("proc.capLayers", { n: layers }), tone: layers < 4 ? "warn-text" : "accent-text" };
  }
  // Only a plain reconfiguration (not a handover or measurement one) is relabelled.
  if (/^RRCReconfiguration$/i.test(msg) && base.procedure === t("proc.rrcReconfig")) {
    const bits = full.match(/ri[_-]Restriction\s*[=:]?\s*([01]{4,8})\b/i)?.[1];
    // Bit string printed rank 8 … rank 1: the highest allowed rank is the leftmost 1.
    if (bits && bits.includes("1")) {
      const rank = bits.length - bits.indexOf("1");
      return { procedure: t("proc.riRestriction", { rank, bits }), tone: rank < 4 ? "warn-text" : "accent-text" };
    }
  }
  if (/0xB8A7\]/.test(msg)) {
    const ri = full.match(/^\s*ri\s*:\s*(\d+)/m)?.[1];
    const cqi = full.match(/wb_cqi\s*:\s*(\d+)/)?.[1];
    if (ri !== undefined) return { procedure: t("proc.csiDetail", { rank: Number(ri) + 1, cqi: cqi ?? "—" }), tone: "" };
  }
  if (/0xB887\]/.test(msg)) {
    const rows = [...full.matchAll(/C_RNTI\(\d+\)\s+\d+\s+(\d+)\s+\d+\s+(PASS|FAIL)/g)];
    if (rows.length) {
      const layers = [...new Set(rows.map((row) => row[1]))].join("/");
      const fails = rows.filter((row) => row[2] === "FAIL").length;
      return { procedure: t("proc.pdschDetail", { layers, n: rows.length, fails }), tone: "" };
    }
  }
  if (/0xB885\]/.test(msg)) {
    const grants = ulGrants(full);
    if (grants.length) {
      const retx = grants.filter(({ rv }) => rv !== "0").length;
      return { procedure: t("proc.ulGrantsDetail", { n: grants.length, retx }), tone: retx ? "accent-text" : "" };
    }
  }
  if (/0xB883\]/.test(msg)) {
    const records = puschRecords(full);
    const time = (item) => Date.parse(item?.ts?.replace(" ", "T"));
    const gap = time(event) - time(preceding);
    const grants = /0xB885\]/.test(preceding?.msg) && gap >= 0 && gap <= 50
      ? ulGrants(preceding.full || "") : [];
    const paired = grants.length === records.length
      && grants.every(({ harqId, mcs }, index) => harqId === records[index].harqId && mcs === records[index].mcs);
    const retransmissions = paired ? records.filter((_, index) => grants[index].rv !== "0") : [];
    const ignored = retransmissions.filter(({ type, newTb, rv }) => type === "NEW_TX" && newTb === "TRUE" && rv === "0").length;
    if (ignored) return { procedure: t("proc.puschRetxIgnored", { ignored, asked: retransmissions.length }), tone: "bad-text", retxIgnored: true };
    const sent = (full.match(/tx_type\s*:\s*RE_TX/g) || []).length;
    const fresh = (full.match(/tx_type\s*:\s*NEW_TX/g) || []).length;
    if (sent + fresh) return { procedure: t("proc.puschDetail", { fresh, sent }), tone: retransmissions.length && retransmissions.every(({ type }) => type === "RE_TX") ? "good-text" : "" };
  }
  if (/0xB872\]/.test(msg)) {
    const bsr = full.match(/S-BSR\s+(\d+)/)?.[1];
    const ph = full.match(/S-PHR\s+(\d+)/)?.[1];
    if (bsr || ph) return { procedure: t("proc.ulTbDetail", { bsr: bsr ?? "—", ph: ph ? Number(ph) - 32 : "—" }), tone: "" };
  }
  if (/0xB884\]/.test(msg)) {
    const power = full.match(/transmit_power\s*:\s*(-?[\d.]+)/)?.[1];
    if (power) return { procedure: t("proc.puschPowerDetail", { power: number(power) }), tone: "" };
  }
  if (/0xB8D8\]/.test(msg)) {
    const snr = [...full.matchAll(/SNR\[\d+\]\s*:\s*(-?[\d.]+)/g)].map((match) => Number(match[1]));
    if (snr.length) return { procedure: t("proc.servingSnrDetail", { n: snr.length, min: number(Math.min(...snr)), max: number(Math.max(...snr)) }), tone: "" };
  }
  if (/^Modem Counters Snapshot$/i.test(msg)) {
    const rlc = Number(full.match(/UL_RLC_retx_pct\s*:\s*([\d.]+)/)?.[1]);
    const rlf = full.match(/RLF_events\s*:\s*(\d+)/)?.[1] ?? "—";
    // RLC retransmission should stay around 1 % or less: above that, HARQ is failing.
    if (Number.isFinite(rlc)) return { procedure: t("proc.countersDetail", { rlc: number(rlc, 2), rlf }), tone: rlc > 5 ? "bad-text" : rlc > 1 ? "warn-text" : "good-text" };
  }
  return null;
}

function rlmOutOfSync(m) {
  const bler = Number(m.summary.match(/OOS_FILT_BLER\s*([\d.]+)%/i)?.[1]);
  return Number.isFinite(bler) && bler >= OUT_OF_SYNC_BLER;
}

function classify(event) {
  let m = { msg: String(event.msg || "").trim(), summary: String(event.summary || "") };
  // RRC containers (DL/ULInformationTransfer) are labelled by the NAS message
  // they carry, e.g. "Carries NAS: Registration Reject (5GMM-Cause #3 ...)".
  const carried = /^(DL|UL)InformationTransfer$/i.test(m.msg) && m.summary.match(/Carries NAS:\s*([^(]+?)\s*(?:\((.*)\))?$/i);
  if (carried) m = { msg: carried[1], summary: carried[2] || "" };
  for (const rule of RULES) {
    if (rule.when(m)) {
      return { procedure: rule.label(m), tone: typeof rule.tone === "function" ? rule.tone(m) : rule.tone };
    }
  }
  if (event.aggregate) return { procedure: event.msg || t("proc.caseStep"), tone: "accent-text" };
  return { procedure: event.msg || t("proc.ongoing"), tone: "" };
}

// Air-interface direction for chipset events that represent a transmission
// (PRACH preambles are UL Msg1 even though the log files them as "Event").
function linkDirection(event) {
  if (/PRACH attempt\s*\d+/i.test(event.summary || "")) return "UL";
  // Cell detection is the UE receiving the cell's sync signals (PSS/SSS, SSB): downlink.
  if (/PSS\/SSS Detected|SSB Detected/i.test(event.msg || "")) return "DL";
  return "";
}

const lastMatch = (text, pattern) => {
  const matches = [...text.matchAll(pattern)];
  return matches.length ? matches[matches.length - 1][1] : "";
};

// Returns new event objects with an `analysis` field holding both the
// per-event classification and the state accumulated up to that event.
export function analyzeEvents(events) {
  const attempts = events.map((event) => Number(event.attempt)).filter(Number.isFinite);
  const attemptMax = attempts.length ? Math.max(...attempts) : 0;
  let selectedPlmn = "";
  let suciPlmn = "";
  let latestCell = "";
  let measurementSummary = "";
  let currentAttempt = null;
  let requestedEbi = "";
  let cellPlmn = "";
  let homePlmn = "";
  let throughput = null;
  let radio = null;

  return events.map((event, index) => {
    const base = classify(event);
    const previous = events[index - 1];
    const preceding = /0xB8A7\]/.test(previous?.msg) ? events[index - 2] : previous;
    const detail = kpiDetail(event, base, preceding);
    // Latest application throughput and radio snapshot, for the "throughput" cell panel.
    if (/^(Throughput Sample|iPerf3 Session End)$/i.test(event.msg || "")) throughput = throughputParams(event.summary || "");
    if (/^Radio Snapshot$/i.test(event.msg || "")) radio = radioParams(event.summary || "");
    const text = `${event.msg || ""} ${event.summary || ""} ${event.full || ""}`;
    // A dedicated bearer accept must echo the EBI of the request (TS 24.301 §6.4.2);
    // an accept with another EBI is not matched by the network, which retransmits on T3485.
    const ebi = (event.summary || "").match(/EBI\s*(\d+)/i)?.[1] || "";
    if (/^Activate dedicated EPS bearer context request$/i.test(event.msg || "")) requestedEbi = ebi;
    const ebiMismatch = /^Activate dedicated EPS bearer context accept$/i.test(event.msg || "") && requestedEbi && ebi && ebi !== requestedEbi;
    // Identity is per registration attempt: don't carry the previous attempt's PLMN/SUCI over.
    if (event.attempt && event.attempt !== currentAttempt) {
      currentAttempt = event.attempt;
      selectedPlmn = "";
      suciPlmn = "";
    }
    // "selectedPLMN 1 (724/078)" carries an index into the SIB1 list before the PLMN itself.
    selectedPlmn = lastMatch(text, /selectedPLMN[=: ]+(?:\d+\s*\()?(\d{3}\/\d{2,3})/gi) || selectedPlmn;
    // PLMN of the cell in use, and the first one seen (the registered PLMN): a cell
    // selected in another PLMN while the home one still has cells breaks the
    // emergency network-selection order (TS 22.101 / TS 23.167).
    const plmnHere = (event.summary || "").match(/(?:selectedPLMN|PLMN)[=: ]+(?:\d+\s*\()?(\d{3}\/\d{2,3})/i)?.[1] || "";
    if (plmnHere) {
      cellPlmn = plmnHere;
      homePlmn ||= plmnHere;
    }
    const otherPlmn = /Cell Selection Decision|^LTE Cell Selection$/i.test(event.msg || "") && plmnHere && plmnHere !== homePlmn;
    // Completed, but outside the home network: not the preferred path.
    const establishedAway = /Emergency Call Established/i.test(event.msg || "") && plmnHere && plmnHere !== homePlmn;
    suciPlmn = lastMatch(text, /Home-Network-Id[=: ]+([0-9/]+)/gi) || suciPlmn;
    if (event.cell) latestCell = event.cell;
    if (/MEASUREMENT REPORT/i.test(event.msg || "")) measurementSummary = event.summary || "";

    return {
      ...event,
      analysis: {
        ...base,
        ...(detail || {}),
        throughput,
        radio,
        ...(ebiMismatch ? { procedure: t("proc.bearerEbiMismatch", { ebi, expected: requestedEbi }), tone: "bad-text" } : {}),
        ...(otherPlmn ? { procedure: t("proc.otherPlmnSelected", { plmn: plmnHere, home: homePlmn }), tone: "bad-text" } : {}),
        ...(establishedAway ? { tone: "warn-text" } : {}),
        cellPlmn,
        homePlmn,
        direction: linkDirection(event),
        attempt: event.attempt ? Number(event.attempt) : 0,
        attemptMax,
        pci: event.cell?.match(/PCI\s*([0-9]+)/i)?.[1] || "",
        latestPci: latestCell.match(/PCI\s*([0-9]+)/i)?.[1] || "",
        selectedPlmn,
        suciPlmn,
        measId: measurementSummary.match(/measId\s*=\s*(\d+)/i)?.[1] || "",
        signal: measurementSummary.match(/(?:serv|SS-RSRP)[^,\t]*/i)?.[0] || ""
      }
    };
  });
}
