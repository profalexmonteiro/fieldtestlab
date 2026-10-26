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
  { when: (m) => /^Measurement Report$/i.test(m.msg), tone: "accent-text",
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
  { when: (m) => /Registration Accept|Attach Accept/i.test(m.msg), tone: "good-text", label: () => t("proc.accepted") },
  { when: (m) => /Registration Complete|Attach Complete/i.test(m.msg), tone: "good-text", label: () => t("proc.registered") },
  { when: (m) => /Registration Request|Attach Request/i.test(m.msg), tone: "accent-text", label: () => t("proc.registrationRequest") },
  { when: (m) => /^Authentication (Request|Response)$/i.test(m.msg), tone: "accent-text", label: () => t("proc.auth") },
  { when: (m) => /^Security Mode (Command|Complete)$/i.test(m.msg), tone: "accent-text", label: () => t("proc.security") },
  { when: (m) => /PDU session establishment/i.test(m.msg), tone: "accent-text", label: () => t("proc.pduSession") },
  { when: (m) => /^RRCSetup(Request|Complete)?$/i.test(m.msg), tone: "accent-text", label: () => t("proc.rrc") },
  { when: (m) => /^RRCRelease$/i.test(m.msg), tone: "warn-text", label: () => t("proc.rrcRelease") },
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

  return events.map((event) => {
    const text = `${event.msg || ""} ${event.summary || ""} ${event.full || ""}`;
    selectedPlmn = lastMatch(text, /selectedPLMN[=: ]+([0-9/]+)/gi) || selectedPlmn;
    suciPlmn = lastMatch(text, /Home-Network-Id[=: ]+([0-9/]+)/gi) || suciPlmn;
    if (event.cell) latestCell = event.cell;
    if (/MEASUREMENT REPORT/i.test(event.msg || "")) measurementSummary = event.summary || "";

    return {
      ...event,
      analysis: {
        ...classify(event),
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
