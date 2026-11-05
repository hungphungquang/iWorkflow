// 4M Change model for the wireframe. Steps, element ids, form keys, variables and fields come from the
// production BPMN/forms (iw_prod, 03/11/2026); statistics are aggregates; people are fictional role holders.

export type Decision = { value: string; label: string; tone: "primary" | "secondary" | "danger" };

export type FourMStepId =
  | "create" | "mgr" | "gm" | "relsec" | "gd"
  | "result" | "rmgr" | "rgm" | "rrelsec" | "rgd" | "review";

export type FourMStep = {
  id: FourMStepId;
  phase: "before" | "after";
  processKey: string;
  elementId: string;
  name: string;
  nameVi: string;
  role: string;
  assigneeExpr: string;
  formKey: string;
  sla: string;
  decisionVar?: string;
  decisions?: Decision[];
  emailApproval?: boolean;
};

const PDTC: Decision[] = [
  { value: "P4M_Button_PD", label: "Phê duyệt", tone: "primary" },
  { value: "P4M_Button_YCCS", label: "Yêu cầu chỉnh sửa", tone: "secondary" },
  { value: "P4M_Button_TC", label: "Từ chối", tone: "danger" },
];
export const TPPC: Decision[] = [
  { value: "Button_4M_TPXL_PD", label: "Phê duyệt (tự xử lý)", tone: "primary" },
  { value: "Button_4M_TPXL_PC", label: "Phân công cán bộ", tone: "secondary" },
  { value: "Button_4M_TPXL_YCCS", label: "Yêu cầu chỉnh sửa", tone: "secondary" },
  { value: "Button_4M_TPXL_TC", label: "Từ chối", tone: "danger" },
];
const XL: Decision[] = [
  { value: "Button_4M_TT", label: "Tiếp tục", tone: "primary" },
  { value: "Button_4M_KT", label: "Kết thúc (hủy 4M)", tone: "danger" },
];

export const steps: FourMStep[] = [
  { id: "create", phase: "before", processKey: "Process4MChange", elementId: "sid-A6406A5A-DEC2-4064-AB06-102B2F504EFF", name: "Create 4M Change request", nameVi: "Tạo yêu cầu thay đổi 4M", role: "Người đề nghị", assigneeExpr: "${init}", formKey: "P4MForm_Request_BTMV", sla: "—" },
  { id: "mgr", phase: "before", processKey: "Process4MChange", elementId: "ManagerApprove", name: "Manager check 4M Change request", nameVi: "Trưởng phòng đề nghị kiểm tra", role: "Trưởng phòng (người đại diện) đơn vị đề nghị", assigneeExpr: "${P4MForm_DonVi_DAI_DIEN}", formKey: "P4MForm_Request_BTMV#P4M_Button_PDTC", sla: "2 ngày", decisionVar: "P4M_Button_PDTC", decisions: PDTC, emailApproval: true },
  { id: "gm", phase: "before", processKey: "Process4MChange", elementId: "GeneralApprove", name: "General Manager approve 4M Change request", nameVi: "GM đơn vị đề nghị phê duyệt", role: "Lãnh đạo (GM) đơn vị đề nghị", assigneeExpr: "${P4MForm_DonVi_LANH_DAO}", formKey: "P4MForm_BTMV_RV#P4M_Button_PDTC", sla: "2 ngày", decisionVar: "P4M_Button_PDTC", decisions: PDTC, emailApproval: true },
  { id: "relsec", phase: "before", processKey: "RelSecProc_2510", elementId: "ManagerCheckRequest", name: "Approve 4M Change request (Related Sections)", nameVi: "Các phòng ban liên quan thẩm định (song song)", role: "Trưởng phòng từng phòng ban liên quan", assigneeExpr: "${P4M_PBXL_PB_DAI_DIEN} → init", formKey: "P4M_PBXL#Button_4M_TPPC", sla: "2 ngày / phòng", decisionVar: "Button_4M_TPPC", decisions: TPPC },
  { id: "gd", phase: "before", processKey: "Process4MChange", elementId: "sid-D310FEED-856A-4543-A324-4BF9F78671DC", name: "General Director approve to continue 4M Change", nameVi: "Tổng Giám đốc quyết định tiếp tục / hủy", role: "Tổng Giám đốc", assigneeExpr: "Toshiaki.Matsushima (cố định trong BPMN)", formKey: "P4MForm_BTMV_RV#Button_4M_XL", sla: "3 ngày", decisionVar: "Button_4M_XL", decisions: XL },
  { id: "result", phase: "after", processKey: "Process4MChangeResult", elementId: "sid-A6406A5A-DEC2-4064-AB06-102B2F504EFF", name: "Input 4M Change Result", nameVi: "Nhập kết quả thay đổi 4M", role: "Người đề nghị", assigneeExpr: "${init} = P4MForm_NguoiDN", formKey: "P4MForm_Results_BTMV", sla: "7 ngày" },
  { id: "rmgr", phase: "after", processKey: "Process4MChangeResult", elementId: "sid-EB41ABE7-E323-45F8-B432-485F72EA988C", name: "Check 4M Change Result", nameVi: "Trưởng phòng kiểm tra kết quả", role: "Trưởng phòng (người đại diện) đơn vị đề nghị", assigneeExpr: "${P4MForm_DonVi_DAI_DIEN}", formKey: "P4MForm_Results_BTMV#P4M_Button_PDTC", sla: "2 ngày", decisionVar: "P4M_Button_PDTC", decisions: PDTC },
  { id: "rgm", phase: "after", processKey: "Process4MChangeResult", elementId: "sid-5FB83087-5740-4E41-91C3-417B5213594E", name: "Approve 4M Change Result", nameVi: "GM phê duyệt kết quả", role: "Lãnh đạo (GM) đơn vị đề nghị · nhóm lanhdao", assigneeExpr: "${P4MForm_DonVi_LANH_DAO}", formKey: "P4MF_Results_BTMV_RV#P4M_Button_PDTC", sla: "2 ngày", decisionVar: "P4M_Button_PDTC", decisions: PDTC },
  { id: "rrelsec", phase: "after", processKey: "RelSecProcResult", elementId: "sid-F1BB36A3-78A1-4D10-91B5-0BACB542AB09", name: "Approve 4M Change Result (Related Sections)", nameVi: "Các phòng ban liên quan xác nhận kết quả (song song)", role: "Trưởng phòng từng phòng ban liên quan", assigneeExpr: "${P4M_PBXL_PB_RS_DAI_DIEN} → init", formKey: "P4M_PBXL_RS#Button_4M_TPPC", sla: "2 ngày / phòng", decisionVar: "Button_4M_TPPC", decisions: TPPC },
  { id: "rgd", phase: "after", processKey: "Process4MChangeResult", elementId: "sid-5B8186AB-B0B2-4CCE-A5F2-3BBB5FD895AF", name: "General Director approve 4M Result", nameVi: "Tổng Giám đốc quyết định với kết quả bị từ chối", role: "Tổng Giám đốc", assigneeExpr: "Toshiaki.Matsushima (cố định trong BPMN)", formKey: "P4MF_Results_BTMV_RV#Button_4M_XL", sla: "3 ngày", decisionVar: "Button_4M_XL", decisions: XL },
  { id: "review", phase: "after", processKey: "Process4MChangeResult", elementId: "print-finish", name: "Review 4M Change Result", nameVi: "Người đề nghị xác nhận hoàn thành", role: "Người đề nghị", assigneeExpr: "${init}", formKey: "P4MF_Results_BTMV_RV", sla: "2 ngày" },
];

export const stepById = (id: FourMStepId) => steps.find((s) => s.id === id)!;

// Real section codes from HT_DONVI; manager/GM are fictional role holders standing in for nguoi_dai_dien / lanh_dao_dai_dien.
export type Section = { code: string; name: string; manager: string; gm: string };
export const sections: Section[] = [
  { code: "8311", name: "ENG – Kỹ thuật", manager: "Trưởng phòng ENG", gm: "Trưởng phòng ENG (cùng người)" },
  { code: "3221", name: "EHS – An toàn môi trường", manager: "Trưởng phòng EHS", gm: "GM QA" },
  { code: "3211", name: "QA – Đảm bảo chất lượng", manager: "Trưởng phòng QA", gm: "GM QA" },
  { code: "8411", name: "TS – Kỹ thuật sản xuất", manager: "Trưởng phòng TS", gm: "GM TS" },
  { code: "8511", name: "Pro1 – Sản xuất 1", manager: "Trưởng xưởng SX1", gm: "Plant Manager" },
  { code: "8512", name: "Production2 – Sản xuất 2", manager: "Trưởng xưởng SX2", gm: "Plant Manager" },
  { code: "3212H", name: "FI – Kiểm tra cuối", manager: "Trưởng phòng FI", gm: "Trưởng phòng QA" },
  { code: "8514", name: "VMEC – Bảo trì", manager: "Trưởng phòng VMEC", gm: "Plant Manager" },
  { code: "1213", name: "GA – Hành chính", manager: "Trưởng phòng GA", gm: "GM HR" },
  { code: "3311", name: "PUR – Mua hàng", manager: "Trưởng phòng PUR", gm: "Trưởng phòng PUR" },
  { code: "1511", name: "IT", manager: "Trưởng nhóm IT", gm: "Plant Manager / IT Dept" },
];
export const sectionByCode = (code: string) => sections.find((s) => s.code === code)!;
/** iw_prod read-only mode: replace the section catalogue in place with HT_DONVI. */
export const replaceSections = (next: Section[]) => void sections.splice(0, sections.length, ...next);

export const classOptions = [
  { code: "Q", label: "Q – Quality" },
  { code: "S", label: "S – Safety" },
  { code: "C", label: "C – Cost" },
  { code: "D", label: "D – Delivery" },
  { code: "E", label: "E – Environment" },
];

// Field codes/labels/types exactly as configured in TRUONG_THONG_TIN for the 4M forms.
export const requestFields = [
  { code: "P4MForm_Title", label: "Title", type: "text", required: true },
  { code: "P4MForm_ProcessText", label: "4M Process", type: "text", required: true },
  { code: "P4M_class", label: "4M change class", type: "multi", required: true, picklist: "4M_Class" },
  { code: "P4MForm_Situation", label: "Current Situation", type: "textarea", required: true },
  { code: "P4MForm_Detail", label: "Detail of Change", type: "textarea", required: true },
  { code: "P4MForm_Purpose", label: "Purpose", type: "textarea", required: true },
  { code: "P4MForm_ExpectedDate", label: "Expected change date", type: "date", required: true },
  { code: "P4MForm_NguoiDN", label: "Người khởi tạo", type: "user", required: true, readonly: true },
  { code: "P4MForm_DonVi", label: "Đơn vị đề nghị", type: "section", required: true, readonly: true },
] as const;

export const relatedSectionColumns = [
  { code: "P4M_PBXL_PB", label: "Phòng ban xử lý", note: "Người đề nghị chọn" },
  { code: "P4M_RiskAsessmentDM", label: "Risk Assessment", note: "Phòng liên quan điền (Y/N)" },
  { code: "P4M_Standardization", label: "Standardization needs", note: "Phòng liên quan điền (Y/N)" },
  { code: "P4M_Initial_Control", label: "Initial control needs", note: "Phòng liên quan điền (Y/N)" },
  { code: "P4M_Cancel", label: "Cancel 4M Change", note: "Phòng liên quan điền (Y/N)" },
];

export const resultFields = [
  { code: "P4M_ActualDate", label: "Actual applied date", type: "date", required: true },
  { code: "P4MForm_HaveProb", label: "Have a problem", type: "yn", required: true },
  { code: "P4MForm_Content", label: "Problem content", type: "text", required: false, showIf: "P4MForm_HaveProb = Y" },
  { code: "P4MForm_Measure", label: "Measure", type: "textarea", required: false, showIf: "P4MForm_HaveProb = Y" },
];

export const riskFields = [
  { code: "P4MForm_RelateSafe", label: "Relate Safety Law (Y/N)" },
  { code: "P4MForm_SafetyLawNo", label: "Law No" },
  { code: "P4MForm_SafetyAction", label: "Safety Action to perform" },
  { code: "P4MForm_EnvRelated", label: "Env Related (Y/N)" },
  { code: "P4MForm_EnvLawNo", label: "Law No" },
  { code: "P4MForm_EnvAction", label: "Env Action to perform" },
];

// Aggregates from iw_prod (03/11/2026).
export const stats = {
  startedByYear: [
    { label: "2019", value: 84 }, { label: "2020", value: 156 }, { label: "2021", value: 124 }, { label: "2022", value: 95 },
    { label: "2023", value: 77 }, { label: "2024", value: 88 }, { label: "2025", value: 90 }, { label: "2026", value: 72 },
  ],
  open: 407,
  abandoned: 323,
  avgRelatedSections: 7.9,
  attachments: 449,
  casesWithAttachments: 189,
  engShare: 63,
  stepDurations: [
    { step: "Tạo yêu cầu (đến khi gửi)", done: 242, medianH: 20.5, p90H: 1290.9, latePct: null },
    { step: "Trưởng phòng đề nghị kiểm tra", done: 217, medianH: 24.6, p90H: 141.7, latePct: 38.7 },
    { step: "GM đơn vị đề nghị phê duyệt", done: 201, medianH: 3.4, p90H: 118.4, latePct: 19.9 },
    { step: "Phòng liên quan thẩm định (TP)", done: 1210, medianH: 22.0, p90H: 667.4, latePct: 38.7 },
    { step: "Cán bộ phòng liên quan kiểm tra", done: 305, medianH: 31.3, p90H: 659.7, latePct: 43.6 },
    { step: "TP phòng liên quan duyệt lại sau cán bộ", done: 280, medianH: 18.1, p90H: 287.4, latePct: 30.4 },
    { step: "Nhập kết quả thay đổi 4M", done: 42, medianH: 801.9, p90H: 6698.7, latePct: 64.3 },
    { step: "Trưởng phòng kiểm tra kết quả", done: 58, medianH: 21.6, p90H: 168.2, latePct: 31.0 },
    { step: "GM phê duyệt kết quả", done: 57, medianH: 16.9, p90H: 172.0, latePct: 24.6 },
    { step: "Phòng liên quan xác nhận kết quả", done: 335, medianH: 19.9, p90H: 843.4, latePct: 34.9 },
    { step: "Người đề nghị xác nhận hoàn thành", done: 15, medianH: 1.4, p90H: 527.6, latePct: 20.0 },
  ],
  decisionsApproval: [
    { label: "Phê duyệt (PD)", value: 376 }, { label: "Yêu cầu chỉnh sửa (YCCS)", value: 43 }, { label: "Từ chối (TC)", value: 0 },
  ],
  decisionsRelated: [
    { label: "Phê duyệt (PD)", value: 1057 }, { label: "Phân công cán bộ (PC)", value: 313 }, { label: "Yêu cầu chỉnh sửa (YCCS)", value: 28 }, { label: "Từ chối (TC)", value: 2 },
  ],
  // RelSecProc_2510 tasks per section representative (people mapped to their HT_DONVI section).
  topRelatedSections: [
    { label: "EHS (3221/322A)", value: 224 }, { label: "QA (3211)", value: 178 }, { label: "TS (8411/841A)", value: 96 },
    { label: "Pro1 (8511)", value: 95 }, { label: "QA GM (321)", value: 92 }, { label: "ENG H1 (8311H1)", value: 68 },
    { label: "Plant Manager (800/851)", value: 66 },
  ],
  // Cases containing each class (179 cases have P4M_class in form XML; multi-select).
  classMix: [
    { label: "Q – Quality", value: 91 }, { label: "S – Safety", value: 74 }, { label: "C – Cost", value: 68 }, { label: "D – Delivery", value: 52 }, { label: "E – Environment", value: 31 },
  ],
  requesterSections: [
    { label: "8311 ENG", value: 105 }, { label: "1511 IT", value: 13 }, { label: "3212H FI", value: 9 }, { label: "841A TS", value: 8 },
    { label: "8311H/H1/H2 ENG", value: 7 }, { label: "1213 GA", value: 6 }, { label: "3221 EHS", value: 5 }, { label: "Khác", value: 13 },
  ],
};

// ---------------------------------------------------------------------------------------------
// Simulation engine – mirrors the BPMN gateways so reviewers can walk every branch in the browser.
// ---------------------------------------------------------------------------------------------

export type SectionRunStatus = "pending" | "staff" | "recheck" | "approved" | "update" | "reject" | "cancelled";
export type SectionRun = { code: string; status: SectionRunStatus; staff: string[] };
export type LogEntry = { at: number; kind: "task" | "decision" | "service" | "event" | "end"; text: string; ref?: string };
export type EndState = "completed" | "rejected" | "cancelled";

export type SimState = {
  step: FourMStepId | null;
  visited: FourMStepId[];
  ended: EndState | null;
  requesterSection: string;
  related: string[];
  runs: SectionRun[];
  round: number;
  vars: Record<string, string>;
  log: LogEntry[];
  seq: number;
};

export type SimAction =
  | { type: "submit" }
  | { type: "decide"; value: string }
  | { type: "section"; code: string; value: string; staff?: string[] }
  | { type: "staffDone"; code: string }
  | { type: "review" }
  | { type: "setRelated"; codes: string[] }
  | { type: "reset" };

export function initialSim(requesterSection = "8311", related = ["3221", "3211", "8411", "8511"]): SimState {
  const s: SimState = { step: "create", visited: ["create"], ended: null, requesterSection, related, runs: [], round: 0, vars: {}, log: [], seq: 0 };
  return log(s, "task", "Khởi tạo Process4MChange – giao bước “Tạo yêu cầu” cho người đề nghị", stepById("create").elementId);
}

function log(s: SimState, kind: LogEntry["kind"], text: string, ref?: string): SimState {
  return { ...s, seq: s.seq + 1, log: [{ at: s.seq + 1, kind, text, ref }, ...s.log] };
}

function enter(s: SimState, step: FourMStepId): SimState {
  const def = stepById(step);
  let next: SimState = { ...s, step, visited: s.visited.includes(step) ? s.visited : [...s.visited, step] };
  if (step === "relsec" || step === "rrelsec") {
    next = { ...next, round: s.round + 1, runs: s.related.map((code) => ({ code, status: "pending", staff: [] })) };
    next = log(next, "event", `Transaction sub-process: ${s.related.length} call activity ${def.processKey} chạy song song (vòng ${next.round})`, "sid-C23F28A8-D04A-46BF-B363-627E429E1171");
    return next;
  }
  if (def.emailApproval) next = log(next, "service", "EmailApprovalTokenDelegate: tạo token phê duyệt qua email (ký HMAC, hết hạn, dùng 1 lần)", step === "mgr" ? "ManagerDuyetMail" : "GMDuyetquaMail");
  return log(next, "task", `Giao bước “${def.nameVi}” – ${def.role}; gửi email thông báo`, def.elementId);
}

function finish(s: SimState, end: EndState, text: string): SimState {
  const withMail = end === "completed" ? s : log(s, "service", "RejectNotificationDelegate: gửi email thông báo từ chối/hủy cho người đề nghị", "Reject");
  return log({ ...withMail, step: null, ended: end }, "end", text);
}

// Error/cancel end events interrupt the whole multi-instance transaction at once (BPMN semantics);
// sibling sections still open are terminated.
function afterRelated(s: SimState): SimState {
  const phaseA = s.step === "relsec";
  const open = (r: SectionRun) => r.status === "pending" || r.status === "staff" || r.status === "recheck";
  const interrupt = (st: SimState) => ({ ...st, runs: st.runs.map((r) => (open(r) ? { ...r, status: "cancelled" as const } : r)) });
  if (s.runs.some((r) => r.status === "update")) {
    const next = log(interrupt(s), "event", "Phòng ban YCCS → error end → boundary error: dừng toàn bộ vòng thẩm định, quay lại người đề nghị", phaseA ? "sid-ACF1BD51-79EA-42A8-9E5A-584E11BB7C5C" : "sid-4E417BB4-FB36-4218-9547-1B6FD29A2D23");
    return enter(next, phaseA ? "create" : "result");
  }
  if (s.runs.some((r) => r.status === "reject")) {
    const next = log(interrupt(s), "event", "Phòng ban từ chối → cancel end → boundary cancel: dừng vòng thẩm định, chuyển Tổng Giám đốc quyết định", phaseA ? "sid-D2729346-0BE8-491B-9A5A-7999DB106740" : "sid-F7B6B723-F4AE-487A-B7ED-661A5E122EC9");
    return enter(next, phaseA ? "gd" : "rgd");
  }
  if (s.runs.some(open)) return s;
  if (phaseA) {
    const next = log(s, "event", "Tất cả phòng ban phê duyệt → call activity Process4MChangeResult (init = người đề nghị)", "sid-8A0B4112-BA88-4710-BF15-5DBC3FBAEA8B");
    return enter(next, "result");
  }
  return enter(log(s, "event", "Tất cả phòng ban xác nhận kết quả", "sid-C23F28A8-D04A-46BF-B363-627E429E1171"), "review");
}

export function simReducer(s: SimState, a: SimAction): SimState {
  if (a.type === "reset") return initialSim(s.requesterSection, s.related);
  if (a.type === "setRelated") return { ...s, related: a.codes };
  if (!s.step) return s;
  const def = stepById(s.step);

  if (a.type === "submit" && (s.step === "create" || s.step === "result")) {
    const msg = s.step === "create" ? `Người đề nghị gửi yêu cầu (${s.related.length} phòng ban liên quan)` : "Người đề nghị gửi kết quả thực hiện";
    return enter(log(s, "decision", msg, def.elementId), s.step === "create" ? "mgr" : "rmgr");
  }
  if (a.type === "review" && s.step === "review") {
    return finish(log(s, "decision", "Người đề nghị xác nhận hoàn thành", def.elementId), "completed", "Process4MChangeResult kết thúc → Process4MChange terminate end “The END”: HOÀN TẤT");
  }
  if (a.type === "decide" && def.decisionVar) {
    const label = def.decisions?.find((d) => d.value === a.value)?.label ?? a.value;
    let next = log({ ...s, vars: { ...s.vars, [def.decisionVar]: a.value } }, "decision", `${def.nameVi}: ${label} (${def.decisionVar}=${a.value})`, def.elementId);
    if (s.step === "mgr" || s.step === "gm" || s.step === "rmgr" || s.step === "rgm") {
      if (a.value === "P4M_Button_YCCS") return enter(next, s.step.startsWith("r") ? "result" : "create");
      if (a.value === "P4M_Button_TC") return finish(next, "rejected", "Hồ sơ bị từ chối – kết thúc");
      const to: Record<string, FourMStepId> = { mgr: "gm", gm: "relsec", rmgr: "rgm", rgm: "rrelsec" };
      return enter(next, to[s.step]);
    }
    if (s.step === "gd" || s.step === "rgd") {
      if (a.value === "Button_4M_KT") return finish(next, "cancelled", "Tổng Giám đốc hủy thay đổi 4M – kết thúc");
      next = log(next, "event", s.step === "gd" ? "Remake: chạy lại vòng thẩm định của các phòng ban" : "Continue: quay lại bước nhập kết quả");
      return enter(next, s.step === "gd" ? "relsec" : "result");
    }
  }
  if (a.type === "section" && (s.step === "relsec" || s.step === "rrelsec")) {
    const runs = s.runs.map((r) => {
      if (r.code !== a.code) return r;
      if (a.value === "Button_4M_TPXL_PC") return { ...r, status: "staff" as const, staff: a.staff ?? [] };
      if (a.value === "Button_4M_TPXL_PD") return { ...r, status: "approved" as const };
      if (a.value === "Button_4M_TPXL_YCCS") return { ...r, status: "update" as const };
      return { ...r, status: "reject" as const };
    });
    const label = TPPC.find((d) => d.value === a.value)?.label;
    const extra = a.value === "Button_4M_TPXL_PC" ? ` → ${a.staff?.length ?? 0} cán bộ kiểm tra song song (multi-instance P4M_CBXL_BMC)` : "";
    return afterRelated(log({ ...s, runs }, "decision", `${sectionByCode(a.code).name}: ${label}${extra}`, def.elementId));
  }
  if (a.type === "staffDone" && (s.step === "relsec" || s.step === "rrelsec")) {
    const runs = s.runs.map((r) => (r.code === a.code ? { ...r, status: "recheck" as const } : r));
    return log({ ...s, runs }, "task", `${sectionByCode(a.code).name}: cán bộ hoàn thành → trưởng phòng duyệt lại`, "sid-3D9A5C01-1A6D-4381-B8AF-39C8FEEB22D3");
  }
  return s;
}

export const sampleCase = {
  code: "ENG-2026-341",
  title: "Thay đổi 4M – máy cán số 3 (thay con lăn dẫn hướng)",
  process: "Thay đổi vật tư con lăn từ thép C45 sang SUS304, cập nhật tiêu chuẩn vận hành",
  classes: ["Q", "S"],
  situation: "Con lăn hiện tại mòn nhanh (3 tháng/lần), gây xước bề mặt bán thành phẩm.",
  detail: "Thay 4 con lăn dẫn hướng bằng vật liệu SUS304, điều chỉnh khe hở 0,2 mm, cập nhật WS-CAN-03.",
  purpose: "Giảm lỗi xước bề mặt 60%, kéo dài chu kỳ bảo trì lên 12 tháng.",
  expected: "2026-12-15",
  requester: "Phạm Quốc Bảo",
  section: "8311",
};
