// UI labels shared by the 4M screens (case list, case detail, new request, tracking) and the dashboards.
// Case data (titles, opinions, history entries, section names) stays as entered.

import type { SectionRunStatus } from "./fourm";
import { caseState, PHASE2_AGES, runProgress, sectionShort, type FourMCase, type OpenTask, type Phase2Status, type TaskKind } from "./fourm-case";
import { common, stepNames, type Locale } from "./i18n";

/** Full role of an open task, e.g. in the case list's "your task" column. */
export const taskKindNames: Record<Locale, Record<TaskKind, string>> = {
  vi: { main: "", section: "Trưởng phòng thẩm định", staff: "Cán bộ kiểm tra", recheck: "TP duyệt lại sau cán bộ" },
  en: { main: "", section: "Section manager review", staff: "Staff check", recheck: "Manager re-check after staff" },
};

const taskKindShort: Record<Locale, Record<TaskKind, string>> = {
  vi: { main: "", section: "TP thẩm định", staff: "Cán bộ kiểm tra", recheck: "TP duyệt lại" },
  en: { main: "", section: "Manager review", staff: "Staff check", recheck: "Manager re-check" },
};

/** "Step · role · section" for an open 4M task. */
export function taskStepLabel(t: OpenTask, locale: Locale) {
  return [stepNames[locale][t.step], taskKindShort[locale][t.kind], t.section ? sectionShort(t.section) : ""].filter(Boolean).join(" · ");
}

/** Localized equivalent of currentStepLabel(c). */
export function caseStepLabel(c: FourMCase, locale: Locale) {
  if (!c.sim.step) return common[locale].state[caseState(c)];
  const name = stepNames[locale][c.sim.step];
  if (c.sim.step === "relsec" || c.sim.step === "rrelsec") {
    const p = runProgress(c);
    return `${name} (${p.done}/${p.total})`;
  }
  return name;
}

/** Decision buttons by BPMN value (P4M_Button_PDTC, Button_4M_TPPC, Button_4M_XL). */
const decisionNames: Record<Locale, Record<string, string>> = {
  vi: {
    P4M_Button_PD: "Phê duyệt",
    P4M_Button_YCCS: "Yêu cầu chỉnh sửa",
    P4M_Button_TC: "Từ chối",
    Button_4M_TPXL_PD: "Phê duyệt (tự xử lý)",
    Button_4M_TPXL_PC: "Phân công cán bộ",
    Button_4M_TPXL_YCCS: "Yêu cầu chỉnh sửa",
    Button_4M_TPXL_TC: "Từ chối",
    Button_4M_TT: "Tiếp tục",
    Button_4M_KT: "Kết thúc (hủy 4M)",
  },
  en: {
    P4M_Button_PD: "Approve",
    P4M_Button_YCCS: "Request changes",
    P4M_Button_TC: "Reject",
    Button_4M_TPXL_PD: "Approve (handle myself)",
    Button_4M_TPXL_PC: "Assign staff",
    Button_4M_TPXL_YCCS: "Request changes",
    Button_4M_TPXL_TC: "Reject",
    Button_4M_TT: "Continue",
    Button_4M_KT: "End (cancel 4M)",
  },
};
export const decisionName = (value: string, locale: Locale) => decisionNames[locale][value] ?? value;

export const phase2Names: Record<Locale, Record<Phase2Status, string>> = {
  vi: { todo: "Chưa thực hiện GĐ2", doing: "Đang thực hiện GĐ2" },
  en: { todo: "Phase 2 not started", doing: "Phase 2 in progress" },
};

export function phase2AgeLabel(id: string, locale: Locale) {
  const b = PHASE2_AGES.find((x) => x.id === id);
  return b ? (locale === "vi" ? b.label : b.labelEn) : id;
}

export const runStatusNames: Record<Locale, Record<SectionRunStatus, string>> = {
  vi: {
    pending: "Chờ TP thẩm định",
    staff: "Cán bộ đang kiểm tra",
    recheck: "TP duyệt lại",
    approved: "Đã thông qua",
    update: "Yêu cầu chỉnh sửa",
    reject: "Từ chối",
    cancelled: "Vòng thẩm định bị hủy",
  },
  en: {
    pending: "Awaiting manager review",
    staff: "Staff checking",
    recheck: "Manager re-check",
    approved: "Approved",
    update: "Changes requested",
    reject: "Rejected",
    cancelled: "Review round cancelled",
  },
};

export const phaseNames: Record<Locale, { before: string; after: string }> = {
  vi: { before: "Giai đoạn 1 · Trước thay đổi", after: "Giai đoạn 2 · Sau thay đổi" },
  en: { before: "Phase 1 · Before change", after: "Phase 2 · After change" },
};

/** Labels of the fixed 4M form fields that are not already English in TRUONG_THONG_TIN. */
export const fieldNames: Record<Locale, { requester: string; section: string; relatedSection: string; relatedNote: string; requesterPicks: string }> = {
  vi: { requester: "Người khởi tạo", section: "Đơn vị đề nghị", relatedSection: "Phòng ban xử lý", relatedNote: "Phòng liên quan điền (Y/N)", requesterPicks: "Người đề nghị chọn" },
  en: { requester: "Initiator", section: "Requesting section", relatedSection: "Handling section", relatedNote: "Filled by related section (Y/N)", requesterPicks: "Chosen by requester" },
};

/** Field names shown in full-text search hits (caseFields() keeps Vietnamese keys). */
const hitFieldNames: Record<string, string> = {
  "Mã hồ sơ": "Case code",
  "Tiêu đề": "Title",
  "Quy trình": "Process",
  "Người đề nghị": "Requester",
  "Phân loại": "Class",
  "Phòng liên quan": "Related sections",
  "Tệp đính kèm": "Attachment",
};
const hitFieldPrefixes: [string, string][] = [
  ["Ý kiến cán bộ ", "Staff opinion "],
  ["Ý kiến xử lý · ", "Decision comment · "],
  ["Ý kiến ", "Opinion "],
  ["Trao đổi · ", "Discussion · "],
];
export function hitFieldName(field: string, locale: Locale) {
  if (locale === "vi") return field;
  if (hitFieldNames[field]) return hitFieldNames[field];
  const p = hitFieldPrefixes.find(([vi]) => field.startsWith(vi));
  return p ? p[1] + field.slice(p[0].length) : field;
}
