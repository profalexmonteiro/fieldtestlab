import { t } from "./i18n.js";

// Classifies each event once, when the log is loaded. Rules look only at the
// message name and its one-line summary, never at the full decode: decodes
// carry incidental words (e.g. "Purpose : RLF", "rlf-TimersAndConstants",
// "prach-ConfigIndex") that would mislabel unrelated messages.
// Rules are checked in order; the first match wins.
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
  { when: (m) => (/^200 OK$/i.test(m.msg) && /registration complete/i.test(m.summary))
      || (/IMS Registration State/i.test(m.msg) && /\bREGISTERED\b/.test(m.summary)),
    tone: "good-text", label: () => t("proc.imsRegistered") },
  { when: (m) => /^REGISTER$/i.test(m.msg), tone: "accent-text", label: () => t("proc.imsRegister") },
  { when: (m) => /Authorization Build/i.test(m.msg) && /CACHED/.test(m.summary), tone: "warn-text", label: () => t("proc.nonceCached") },
  { when: (m) => /^INVITE$/i.test(m.msg), tone: "accent-text", label: () => t("proc.invite") },
  { when: (m) => /^180 Ringing$|^Incoming Call$/i.test(m.msg), tone: "good-text", label: () => t("proc.ringing") },
  { when: (m) => /^200 OK$/i.test(m.msg) && /call answered/i.test(m.summary), tone: "good-text", label: () => t("proc.answered") },
  { when: (m) => /^Vocoder Started( \(CS\))?$/i.test(m.msg), tone: "accent-text", label: (m) => t("proc.vocoder", { codec: m.summary }) },
  { when: (m) => /RTP\/RTCP Statistics/i.test(m.msg), tone: "", label: () => t("proc.rtpStats") },
  { when: (m) => /Deregistration request|Detach request/i.test(m.msg), tone: "warn-text", label: () => t("proc.deregistration") },
  { when: (m) => /Registration Accept|Attach Accept/i.test(m.msg), tone: "good-text", label: () => t("proc.accepted") },
  { when: (m) => /Registration Complete|Attach Complete/i.test(m.msg), tone: "good-text", label: () => t("proc.registered") },
  { when: (m) => /Registration Request|Attach Request/i.test(m.msg), tone: "accent-text", label: () => t("proc.registrationRequest") },
  { when: (m) => /^Authentication (Request|Response)$/i.test(m.msg), tone: "accent-text", label: () => t("proc.auth") },
  { when: (m) => /^Security Mode (Command|Complete)$/i.test(m.msg), tone: "accent-text", label: () => t("proc.security") },
  { when: (m) => /PDU session establishment/i.test(m.msg), tone: "accent-text", label: () => t("proc.pduSession") },
  { when: (m) => /^RRCSetup(Request|Complete)?$|^rrcConnection(Request|Setup|SetupComplete)$/i.test(m.msg), tone: "accent-text", label: () => t("proc.rrc") },
  { when: (m) => /^RRCRelease$|^rrcConnectionRelease$/i.test(m.msg), tone: "warn-text", label: () => t("proc.rrcRelease") },
  { when: (m) => /^(MIB|MasterInformationBlock|SIB\d+|systemInformationBlockType\d+)$/i.test(m.msg), tone: "", label: () => t("proc.sysInfo") },
  { when: (m) => /Measurement Database Update/i.test(m.msg), tone: "", label: () => t("proc.l1Measurement") },
  { when: (m) => /ACQ Config|PSS\/SSS/i.test(m.msg), tone: "", label: () => t("proc.cellSearch") }
];

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

  return events.map((event) => {
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
    selectedPlmn = lastMatch(text, /selectedPLMN[=: ]+([0-9/]+)/gi) || selectedPlmn;
    suciPlmn = lastMatch(text, /Home-Network-Id[=: ]+([0-9/]+)/gi) || suciPlmn;
    if (event.cell) latestCell = event.cell;
    if (/MEASUREMENT REPORT/i.test(event.msg || "")) measurementSummary = event.summary || "";

    return {
      ...event,
      analysis: {
        ...classify(event),
        ...(ebiMismatch ? { procedure: t("proc.bearerEbiMismatch", { ebi, expected: requestedEbi }), tone: "bad-text" } : {}),
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
