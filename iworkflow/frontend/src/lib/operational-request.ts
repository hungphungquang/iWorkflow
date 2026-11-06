// Operational Request Form (ORF) – "Form yêu cầu xử lý hàng hóa" between a requesting section, the 3312 PIC and the
// Yusen finished-goods warehouse. Stage keys, assignees and due dates follow the production BPMN
// (Operational_Request_Form v3, deployment 1650490, verified on iw_prod 2026-11-06).
// This module must stay free of runtime imports: the unit tests evaluate it in isolation.

export const ORF_PROCESS_KEY = "Operational_Request_Form";
export const ORF_REJECT_ACTIVITY = "sid-C499CF5E-0C8B-4B4D-AA64-BE3E9A52C44A";
export const ORF_PIC_3312 = "iw.3312";
export const ORF_YUSEN_WH = "iw.yusen";
/** Barcodes included per request in the list snapshot; the full list is loaded on demand. */
export const ORF_SNAPSHOT_BARCODES = 40;

export const ORF_OPEN_STAGES = ["request", "approval", "pic3312", "warehouse", "result", "resultApproval", "confirm3312", "confirmWH"] as const;
export type OrfOpenStage = (typeof ORF_OPEN_STAGES)[number];
export type OrfStage = OrfOpenStage | "completed" | "rejected" | "cancelled" | "unknown";
export type OrfStatus = "open" | "completed" | "rejected" | "cancelled";
export const ORF_STATUSES: OrfStatus[] = ["open", "completed", "rejected", "cancelled"];

export const ORF_TASKS: Record<string, OrfOpenStage> = {
  "sid-241D48A2-F21B-49CA-8059-714205966A44": "request",
  QAMangerApprove: "approval",
  "sid-1AAB0D8C-7656-4E68-A9D8-9752641D8E61": "pic3312",
  "sid-67946F2B-2CB2-4F8F-BBA4-57D2063FFC2E": "warehouse",
  "sid-88BBC81B-FE55-4930-9D4D-FAC899E7FBC5": "result",
  "sid-C8EA4E61-79CB-4FFA-A3CA-69D48A225B31": "resultApproval",
  "sid-F7AA057A-0D81-4516-BAD8-5FD294C03264": "confirm3312",
  "sid-F711AEB1-B653-40D3-987D-4116ED1A1092": "confirmWH",
};

export const ORF_DUE_DAYS: Record<OrfOpenStage, number> = {
  request: 2, approval: 2, pic3312: 3, warehouse: 3, result: 2, resultApproval: 2, confirm3312: 2, confirmWH: 2,
};

export type OrfDecision = "submit" | "approve" | "revise" | "reject" | "receive" | "confirm" | "";
export type OrfTaskStatus = "completed" | "pending" | "stopped";
export type OrfEvent = { at: string; actor: string; stage: OrfOpenStage | "unknown"; decision: OrfDecision; status: OrfTaskStatus; comment: string };
export type OrfPeriod = { shift: string; date: string };
export type OrfResult = {
  total: string; ok: string; ng: string; reason: string;
  ngHandling: "" | "return" | "keep"; ngDate: string; okRelease: boolean; returnedAt: string; changePlace: string;
};
export type OrfPerson = { id: string; name: string; role?: "requester" | "approver" | "pic3312" | "warehouse" };

export type OperationalRequest = {
  id: string;
  code: string;
  department: string;
  title: string;
  productCode: string;
  quantity: string;
  barcodes: string[];
  barcodeCount: number;
  reason: string;
  lotFrom: OrfPeriod;
  lotTo: OrfPeriod;
  desiredFrom: OrfPeriod;
  desiredTo: OrfPeriod;
  plannedDate: string;
  plannedHandling: string;
  warehouseConfirm: string;
  result: OrfResult;
  requester: string;
  approver: string;
  stage: OrfStage;
  assignee: string;
  startedAt: string;
  dueAt: string;
  endedAt: string;
  endReason: string;
  lastActivityAt: string;
  history: OrfEvent[];
  attachments: { id: string; name: string; url?: string }[];
};

export type OrfSnapshot = { source: "demo" | "iw_prod"; loadedAt: string; requests: OperationalRequest[]; people: OrfPerson[] };

export const emptyOrfResult = (): OrfResult => ({ total: "", ok: "", ng: "", reason: "", ngHandling: "", ngDate: "", okRelease: false, returnedAt: "", changePlace: "" });

export function orfTaskStatus(ended: boolean, reason: string | null): OrfTaskStatus {
  if (!ended) return "pending";
  const normalized = reason?.trim().toLowerCase();
  return normalized && normalized !== "completed" ? "stopped" : "completed";
}

/** Maps the legacy eForm button (user_action.action) of a finished task to a decision. */
export function orfDecision(action: string | null | undefined, stage: OrfOpenStage | "unknown"): OrfDecision {
  if (action === "P4M_Button_PD") return "approve";
  if (action === "P4M_Button_TC") return "reject";
  if (action === "P4M_Button_YCCS") return "revise";
  if (stage === "approval" || stage === "resultApproval") return action ? "" : "approve";
  if (stage === "pic3312" || stage === "warehouse") return "receive";
  if (stage === "confirm3312" || stage === "confirmWH") return "confirm";
  return stage === "unknown" ? "" : "submit";
}

export function orfStatus(request: Pick<OperationalRequest, "stage">): OrfStatus {
  return request.stage === "completed" || request.stage === "rejected" || request.stage === "cancelled" ? request.stage : "open";
}

export function isOrfOverdue(request: OperationalRequest, now: string) {
  return orfStatus(request) === "open" && !!request.dueAt && Date.parse(request.dueAt) < Date.parse(now);
}

/** No task started or finished for more than a year (same definition as the abandoned-instances report). */
export function isOrfStale(request: OperationalRequest, now: string) {
  return orfStatus(request) === "open" && Date.parse(request.lastActivityAt || request.startedAt) < Date.parse(now) - 365 * 86400000;
}

export function orfExpectedAssignee(request: Pick<OperationalRequest, "requester" | "approver">, stage: OrfStage) {
  if (stage === "request" || stage === "result") return request.requester;
  if (stage === "approval" || stage === "resultApproval") return request.approver;
  if (stage === "pic3312" || stage === "confirm3312") return ORF_PIC_3312;
  if (stage === "warehouse" || stage === "confirmWH") return ORF_YUSEN_WH;
  return "";
}

/** Highest BPMN step index reached, used for the progress tracker (rejected/cancelled stop where they ended). */
export function orfReachedIndex(request: OperationalRequest) {
  if (request.stage === "completed") return ORF_OPEN_STAGES.length;
  const current = ORF_OPEN_STAGES.indexOf(request.stage as OrfOpenStage);
  if (current >= 0) return current;
  return Math.max(0, ...request.history.map((event) => ORF_OPEN_STAGES.indexOf(event.stage as OrfOpenStage)));
}

/** Barcode lists are free text: one entry per line, often "barcode<TAB>defect". */
export function splitBarcodes(value: string) {
  return value.split(/\r?\n/).map((line) => line.replace(/\s+/g, " ").trim()).filter(Boolean);
}

export function orfPeriodStart(now: string, months: number) {
  const date = new Date(now);
  const target = new Date(date);
  target.setUTCDate(1);
  target.setUTCMonth(target.getUTCMonth() - months);
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(date.getUTCDate(), lastDay));
  return target.toISOString();
}

const DAY = 86400000;
const ageDays = (from: string, now: number) => Math.max(0, (now - Date.parse(from)) / DAY);

export type OrfBreakdownKey = "completed" | "onTime" | "overdue" | "rejected" | "cancelled";

export function summarizeOrf(snapshot: OrfSnapshot, months: 3 | 6 | 12 = 12, department = "") {
  const now = Date.parse(snapshot.loadedAt);
  const since = orfPeriodStart(snapshot.loadedAt, months);
  const selected = snapshot.requests.filter((request) => !department || request.department === department);
  const cohort = selected.filter((request) => Date.parse(request.startedAt) >= Date.parse(since) && Date.parse(request.startedAt) <= now);
  const withStatus = (list: OperationalRequest[], status: OrfStatus) => list.filter((request) => orfStatus(request) === status);
  const completed = withStatus(cohort, "completed");
  const open = withStatus(cohort, "open");
  const overdue = (request: OperationalRequest) => isOrfOverdue(request, snapshot.loadedAt);
  const durations = completed.map((request) => (Date.parse(request.endedAt) - Date.parse(request.startedAt)) / DAY).filter((days) => Number.isFinite(days) && days >= 0);
  const start = new Date(since);
  const monthly = Array.from({ length: months + 1 }, (_, index) => {
    const month = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + index, 1));
    const key = month.toISOString().slice(0, 7);
    return { key, label: `${month.getUTCMonth() + 1}/${String(month.getUTCFullYear()).slice(-2)}`, value: cohort.filter((request) => request.startedAt.slice(0, 7) === key).length, secondary: completed.filter((request) => request.endedAt.slice(0, 7) === key).length };
  });
  const openStages = [...ORF_OPEN_STAGES, "unknown"] as const;
  const backlog = withStatus(selected, "open").filter((request) => Date.parse(request.startedAt) <= now);
  const departments = [...new Set(selected.map((request) => request.department))].map((name) => {
    const started = cohort.filter((request) => request.department === name);
    const pending = withStatus(started, "open");
    const late = pending.filter(overdue).length;
    return {
      name, started: started.length, completed: withStatus(started, "completed").length, pending: pending.length, onTime: pending.length - late,
      overdue: late, closed: started.length - pending.length - withStatus(started, "completed").length, backlog: backlog.filter((request) => request.department === name).length,
    };
  }).sort((left, right) => right.overdue - left.overdue || right.pending - left.pending || right.started - left.started || left.name.localeCompare(right.name));
  const approvers = [...new Set(backlog.filter((request) => request.stage === "approval" || request.stage === "resultApproval").map((request) => request.assignee || request.approver))].map((id) => {
    const waiting = backlog.filter((request) => (request.stage === "approval" || request.stage === "resultApproval") && (request.assignee || request.approver) === id);
    return { id, pending: waiting.length, overdue: waiting.filter(overdue).length };
  }).sort((left, right) => right.pending - left.pending || left.id.localeCompare(right.id));
  const aging = [
    { key: "7", value: backlog.filter((request) => ageDays(request.startedAt, now) <= 7).length },
    { key: "30", value: backlog.filter((request) => ageDays(request.startedAt, now) > 7 && ageDays(request.startedAt, now) <= 30).length },
    { key: "90", value: backlog.filter((request) => ageDays(request.startedAt, now) > 30 && ageDays(request.startedAt, now) <= 90).length },
    { key: "365", value: backlog.filter((request) => ageDays(request.startedAt, now) > 90 && ageDays(request.startedAt, now) <= 365).length },
    { key: "older", value: backlog.filter((request) => ageDays(request.startedAt, now) > 365).length },
  ];
  const attention = open.filter(overdue).sort((left, right) => left.dueAt.localeCompare(right.dueAt) || left.startedAt.localeCompare(right.startedAt));
  const rejected = withStatus(cohort, "rejected").length;
  const cancelled = withStatus(cohort, "cancelled").length;
  // Mutually exclusive buckets that always add up to `started` (overdue is split out of open).
  const breakdown: { key: OrfBreakdownKey; value: number }[] = [
    { key: "completed", value: completed.length }, { key: "onTime", value: open.length - attention.length },
    { key: "overdue", value: attention.length }, { key: "rejected", value: rejected }, { key: "cancelled", value: cancelled },
  ];
  return {
    since, cohort, started: cohort.length, completed: completed.length, pending: open.length, onTime: open.length - attention.length, overdue: attention.length,
    rejected, cancelled, breakdown,
    completionRate: cohort.length ? completed.length / cohort.length * 100 : null,
    averageDays: durations.length ? durations.reduce((total, days) => total + days, 0) / durations.length : null,
    statuses: ORF_STATUSES.map((status) => ({ status, value: withStatus(cohort, status).length })),
    stages: openStages.map((stage) => ({ stage, value: open.filter((request) => request.stage === stage).length })),
    monthly, departments, approvers, attention,
    backlog: backlog.length, backlogOverdue: backlog.filter(overdue).length,
    backlogInPeriod: open.length,
    backlogOldest: backlog.reduce((oldest, request) => !oldest || request.startedAt < oldest ? request.startedAt : oldest, ""),
    backlogStale: backlog.filter((request) => isOrfStale(request, snapshot.loadedAt)).length,
    backlogStages: openStages.map((stage) => ({ stage, value: backlog.filter((request) => request.stage === stage).length })),
    aging,
  };
}

export type DepartmentSortKey = "name" | "started" | "completed" | "onTime" | "overdue" | "closed" | "backlog";
export type DepartmentSort = { key: DepartmentSortKey; direction: "asc" | "desc" };

export function sortOrfDepartments(departments: ReturnType<typeof summarizeOrf>["departments"], sort: DepartmentSort | null) {
  if (!sort) return [...departments];
  return [...departments].sort((left, right) => {
    const comparison = sort.key === "name" ? left.name.localeCompare(right.name, "vi", { numeric: true }) : left[sort.key] - right[sort.key];
    return (sort.direction === "asc" ? comparison : -comparison) || left.name.localeCompare(right.name, "vi", { numeric: true });
  });
}

// ---------------------------------------------------------------------------------------------
// Demo workflow (mirrors the BPMN gateways; production data is never modified)
// ---------------------------------------------------------------------------------------------

export type OrfRequestInput = {
  department: string; title: string; productCode: string; quantity: string; barcodes: string; reason: string;
  lotFrom: OrfPeriod; lotTo: OrfPeriod; desiredFrom: OrfPeriod; desiredTo: OrfPeriod; plannedDate: string; plannedHandling: string; approver: string;
};

export type OrfAction =
  | { type: "submit"; input: OrfRequestInput; comment?: string }
  | { type: "approve" | "revise" | "reject"; comment: string }
  | { type: "receive"; comment: string; warehouseConfirm?: string }
  | { type: "result"; result: OrfResult; comment?: string }
  | { type: "confirm"; comment: string };

export const ORF_ERRORS = {
  ended: "Hồ sơ đã kết thúc hoặc không thể xử lý.",
  actor: "Bạn không phải người xử lý bước hiện tại.",
  action: "Thao tác không phù hợp với bước hiện tại.",
  comment: "Vui lòng nhập ý kiến khi yêu cầu chỉnh sửa hoặc từ chối.",
  required: "Vui lòng nhập hạng mục, mã sản phẩm, số lượng, lý do và bộ phận yêu cầu.",
  approver: "Vui lòng chọn người phê duyệt hợp lệ.",
  range: "Ngày kết thúc phải sau hoặc bằng ngày bắt đầu.",
  warehouse: "Vui lòng nhập xác nhận của kho thành phẩm.",
  result: "Vui lòng nhập tổng số, số OK, số NG và lý do đánh giá.",
  ngDate: "Vui lòng chọn ngày xử lý hàng NG.",
} as const;

export function validateOrfInput(input: OrfRequestInput, requester: string, people: OrfPerson[]) {
  if (![input.department, input.title, input.productCode, input.quantity, input.reason].every((value) => value.trim())) throw new Error(ORF_ERRORS.required);
  const approver = people.find((person) => person.id === input.approver);
  if (!approver || approver.role !== "approver" || approver.id === requester) throw new Error(ORF_ERRORS.approver);
  for (const [from, to] of [[input.lotFrom, input.lotTo], [input.desiredFrom, input.desiredTo]]) {
    if (from.date && to.date && to.date < from.date) throw new Error(ORF_ERRORS.range);
  }
}

function requestFields(input: OrfRequestInput) {
  const barcodes = splitBarcodes(input.barcodes);
  const trimPeriod = (period: OrfPeriod) => ({ shift: period.shift.trim(), date: period.date });
  return {
    department: input.department.trim().toUpperCase(), title: input.title.trim(), productCode: input.productCode.trim(), quantity: input.quantity.trim(),
    barcodes, barcodeCount: barcodes.length, reason: input.reason.trim(), plannedDate: input.plannedDate, plannedHandling: input.plannedHandling.trim(), approver: input.approver,
    lotFrom: trimPeriod(input.lotFrom), lotTo: trimPeriod(input.lotTo), desiredFrom: trimPeriod(input.desiredFrom), desiredTo: trimPeriod(input.desiredTo),
  };
}

export function orfInputFrom(request: OperationalRequest): OrfRequestInput {
  return {
    department: request.department, title: request.title, productCode: request.productCode, quantity: request.quantity,
    barcodes: request.barcodes.join("\n"), reason: request.reason, lotFrom: { ...request.lotFrom }, lotTo: { ...request.lotTo },
    desiredFrom: { ...request.desiredFrom }, desiredTo: { ...request.desiredTo }, plannedDate: request.plannedDate, plannedHandling: request.plannedHandling, approver: request.approver,
  };
}

function moveTo(request: OperationalRequest, stage: OrfStage, now: string, closing: OrfEvent): OperationalRequest {
  const history = [...request.history];
  const pending = history.findLastIndex((event) => event.status === "pending");
  if (pending >= 0) history[pending] = closing;
  else history.push(closing);
  const open = (ORF_OPEN_STAGES as readonly string[]).includes(stage);
  const next = { ...request, stage, lastActivityAt: now };
  next.assignee = orfExpectedAssignee(next, stage);
  if (open) {
    history.push({ at: now, actor: next.assignee, stage: stage as OrfOpenStage, decision: "", status: "pending", comment: "" });
    return { ...next, history, dueAt: new Date(Date.parse(now) + ORF_DUE_DAYS[stage as OrfOpenStage] * DAY).toISOString(), endedAt: "" };
  }
  return { ...next, history, dueAt: "", endedAt: now };
}

export function applyOrfAction(request: OperationalRequest, action: OrfAction, actor: string, now: string, people: OrfPerson[]): OperationalRequest {
  if (orfStatus(request) !== "open" || request.stage === "unknown") throw new Error(ORF_ERRORS.ended);
  if (!actor || actor !== request.assignee) throw new Error(ORF_ERRORS.actor);
  const stage = request.stage as OrfOpenStage;
  const comment = (action.comment ?? "").trim();
  const close = (decision: OrfDecision): OrfEvent => ({ at: now, actor, stage, decision, status: "completed", comment });
  switch (stage) {
    case "request": {
      if (action.type !== "submit") throw new Error(ORF_ERRORS.action);
      validateOrfInput(action.input, request.requester, people);
      return moveTo({ ...request, ...requestFields(action.input) }, "approval", now, close("submit"));
    }
    case "approval":
    case "resultApproval": {
      if (action.type !== "approve" && action.type !== "revise" && action.type !== "reject") throw new Error(ORF_ERRORS.action);
      if (action.type !== "approve" && !comment) throw new Error(ORF_ERRORS.comment);
      const target: OrfStage = action.type === "reject" ? "rejected" : action.type === "revise" ? (stage === "approval" ? "request" : "result") : stage === "approval" ? "pic3312" : "confirm3312";
      return moveTo(request, target, now, close(action.type));
    }
    case "pic3312":
    case "warehouse": {
      if (action.type !== "receive") throw new Error(ORF_ERRORS.action);
      if (stage === "pic3312") return moveTo(request, "warehouse", now, close("receive"));
      const warehouseConfirm = (action.warehouseConfirm ?? "").trim();
      if (!warehouseConfirm) throw new Error(ORF_ERRORS.warehouse);
      return moveTo({ ...request, warehouseConfirm }, "result", now, close("receive"));
    }
    case "result": {
      if (action.type !== "result") throw new Error(ORF_ERRORS.action);
      const result = { ...action.result, total: action.result.total.trim(), ok: action.result.ok.trim(), ng: action.result.ng.trim(), reason: action.result.reason.trim(), changePlace: action.result.changePlace.trim() };
      if (!result.total || !result.ok || !result.ng || !result.reason) throw new Error(ORF_ERRORS.result);
      if (result.ngHandling && !result.ngDate) throw new Error(ORF_ERRORS.ngDate);
      return moveTo({ ...request, result }, "resultApproval", now, close("submit"));
    }
    case "confirm3312":
    case "confirmWH": {
      if (action.type !== "confirm") throw new Error(ORF_ERRORS.action);
      return moveTo(request, stage === "confirm3312" ? "confirmWH" : "completed", now, close("confirm"));
    }
  }
}

export function createOrfRequest(input: OrfRequestInput, requester: string, now: string, snapshot: OrfSnapshot): OperationalRequest {
  validateOrfInput(input, requester, snapshot.people);
  const fields = requestFields(input);
  const year = now.slice(0, 4);
  const prefix = `${fields.department}-${year}-`;
  const sequence = Math.max(0, ...snapshot.requests.filter((request) => request.code.startsWith(prefix)).map((request) => Number(request.code.slice(prefix.length)) || 0)) + 1;
  const id = `orf-demo-${Math.max(0, ...snapshot.requests.map((request) => Number(request.id.replace(/\D/g, "")) || 0)) + 1}`;
  const draft: OperationalRequest = {
    ...fields, id, code: `${prefix}${String(sequence).padStart(3, "0")}`, warehouseConfirm: "", result: emptyOrfResult(),
    requester, stage: "request", assignee: requester, startedAt: now, dueAt: "", endedAt: "", endReason: "", lastActivityAt: now,
    history: [], attachments: [],
  };
  return moveTo(draft, "approval", now, { at: now, actor: requester, stage: "request", decision: "submit", status: "completed", comment: "" });
}

export function buildOrfDemo(): OrfSnapshot {
  const people: OrfPerson[] = [
    { id: "orf-pic-fi", name: "Minh Tran · FI PIC", role: "requester" },
    { id: "orf-pic-qa", name: "Lan Pham · QA PIC", role: "requester" },
    { id: "orf-approver-fi", name: "Alex Morgan · FI Manager", role: "approver" },
    { id: "orf-approver-qa", name: "Jordan Lee · QA Manager", role: "approver" },
    { id: ORF_PIC_3312, name: "3312 PIC", role: "pic3312" },
    { id: ORF_YUSEN_WH, name: "Yusen WH", role: "warehouse" },
  ];
  const path: OrfOpenStage[] = [...ORF_OPEN_STAGES];
  const decisions: Record<OrfOpenStage, OrfDecision> = { request: "submit", approval: "approve", pic3312: "receive", warehouse: "receive", result: "submit", resultApproval: "approve", confirm3312: "confirm", confirmWH: "confirm" };
  const seeds: { stage: OrfStage; department: "FI" | "QA"; started: string; title: string; productCode: string; quantity: string; reason: string; barcodes: string[]; ending?: OrfDecision }[] = [
    { stage: "approval", department: "FI", started: "2026-11-01T02:00:00.000Z", title: "Tái kiểm đặc biệt lô lốp tháng 10", productCode: "Lốp thành phẩm (nhiều size)", quantity: "36 pcs", reason: "Tái kiểm ngoại quan theo yêu cầu khách hàng", barcodes: ["5GH0HPL", "5GH0HQ4", "DFY875G", "V9601KZ"] },
    { stage: "pic3312", department: "QA", started: "2026-11-04T01:30:00.000Z", title: "Lấy lốp kiểm tra X-ray crown", productCode: "Y5SVA, Y6SVA", quantity: "Y5SVA: 02 pcs, Y6SVA: 01 pcs", reason: "Kiểm tra X-ray theo kế hoạch đánh giá chất lượng", barcodes: ["Z960B1B", "Z960AZT", "Z960AZZ"] },
    { stage: "warehouse", department: "FI", started: "2026-11-04T03:00:00.000Z", title: "Return lốp lệch belt", productCode: "Y4S", quantity: "12", reason: "Lấy về kiểm tra lại lệch belt", barcodes: ["Y4S1400", "Y4S13SH", "Y4S1402"] },
    { stage: "result", department: "FI", started: "2026-10-20T02:00:00.000Z", title: "Tái kiểm hàng tồn kho tuần 42", productCode: "Lốp thành phẩm", quantity: "120", reason: "Tái kiểm định kỳ hàng tồn trên 90 ngày", barcodes: ["MDT051Q", "MDT04XA", "DFY87RA"] },
    { stage: "result", department: "QA", started: "2025-05-12T02:00:00.000Z", title: "Kiểm tra lốp khiếu nại thị trường", productCode: "CBRVA", quantity: "4", reason: "Đối chiếu mẫu khiếu nại", barcodes: ["P2P4T3I", "P2P4T2G"] },
    { stage: "resultApproval", department: "QA", started: "2026-10-28T02:00:00.000Z", title: "Test ER lô sản xuất mới", productCode: "Y9SVA, CBRVA", quantity: "Y9SVA: 01 pcs, CBRVA: 01 pcs", reason: "Test ER", barcodes: ["Y8S06U2", "Y8S06XE"] },
    { stage: "confirm3312", department: "FI", started: "2026-10-26T02:00:00.000Z", title: "Đổi điểm giao hàng thị trường Oceania", productCode: "Y6SVA", quantity: "48", reason: "Thay đổi đích đến theo yêu cầu xuất khẩu", barcodes: ["ETD0V83", "ETD0V86"] },
    { stage: "completed", department: "FI", started: "2026-10-05T02:00:00.000Z", title: "Tái kiểm đặc biệt 02/10/2026", productCode: "Lốp thành phẩm (nhiều size)", quantity: "247", reason: "Tái kiểm đặc biệt", barcodes: ["5LH0NZG", "5LH0OIZ", "5LH0OG9", "5LH0OJ1"] },
    { stage: "rejected", department: "QA", started: "2026-10-15T02:00:00.000Z", title: "Lấy mẫu kiểm tra trùng yêu cầu", productCode: "TGA", quantity: "2", reason: "Kiểm tra mẫu", barcodes: ["TGA1N4E"], ending: "reject" },
    { stage: "request", department: "FI", started: "2026-11-02T02:00:00.000Z", title: "Kiểm tra lốp bị ướt khi lưu kho", productCode: "M8T", quantity: "8", reason: "Kho báo lốp bị ướt do mưa", barcodes: ["M8T0590", "M8T058W"], ending: "revise" },
  ];
  const requests = seeds.map((seed, index): OperationalRequest => {
    const requester = seed.department === "FI" ? "orf-pic-fi" : "orf-pic-qa";
    const approver = seed.department === "FI" ? "orf-approver-fi" : "orf-approver-qa";
    const base = { requester, approver };
    const target = seed.ending ? 2 : seed.stage === "completed" ? path.length : path.indexOf(seed.stage as OrfOpenStage);
    const history: OrfEvent[] = [];
    let at = Date.parse(seed.started);
    for (let step = 0; step < target; step += 1) {
      at += (step === 4 ? 2 : 0.6) * DAY;
      history.push({ at: new Date(at).toISOString(), actor: orfExpectedAssignee(base, path[step]), stage: path[step], decision: step === target - 1 && seed.ending ? seed.ending : decisions[path[step]], status: "completed", comment: step === target - 1 && seed.ending ? (seed.ending === "reject" ? "Trùng với yêu cầu FI-2026-031, không xử lý." : "Bổ sung danh sách barcode và phạm vi ca nhập kho.") : "" });
    }
    const open = (ORF_OPEN_STAGES as readonly string[]).includes(seed.stage);
    const stage = seed.stage as OrfOpenStage;
    if (open) history.push({ at: new Date(at).toISOString(), actor: orfExpectedAssignee(base, stage), stage, decision: "", status: "pending", comment: "" });
    const reached = target >= 4 || seed.stage === "completed";
    const resulted = target >= 5 || seed.stage === "completed";
    return {
      id: `orf-demo-${index + 1}`, code: `${seed.department}-${seed.started.slice(0, 4)}-${String(640 + index).padStart(3, "0")}`, department: seed.department,
      title: seed.title, productCode: seed.productCode, quantity: seed.quantity, barcodes: seed.barcodes, barcodeCount: seed.barcodes.length, reason: seed.reason,
      lotFrom: { shift: "A", date: seed.started.slice(0, 10) }, lotTo: { shift: "C", date: seed.started.slice(0, 10) },
      desiredFrom: { shift: "HC", date: seed.started.slice(0, 10) }, desiredTo: { shift: "HC", date: seed.started.slice(0, 10) },
      plannedDate: new Date(Date.parse(seed.started) + 2 * DAY).toISOString().slice(0, 10), plannedHandling: "Kho thành phẩm chuyển lốp về khu vực kiểm tra", warehouseConfirm: reached ? "Yusen tiếp nhận thông tin, đã trace barcode." : "",
      result: resulted ? { total: seed.quantity, ok: seed.quantity, ng: "0", reason: "Ngoại quan đạt, không phát hiện bất thường.", ngHandling: "", ngDate: "", okRelease: true, returnedAt: new Date(at).toISOString().slice(0, 10), changePlace: "" } : emptyOrfResult(),
      ...base, stage: seed.stage, assignee: open ? orfExpectedAssignee(base, seed.stage) : "", startedAt: seed.started,
      dueAt: open ? new Date(at + ORF_DUE_DAYS[stage] * DAY).toISOString() : "", endedAt: open ? "" : new Date(at).toISOString(), endReason: "",
      lastActivityAt: new Date(at).toISOString(), history, attachments: [],
    };
  });
  return { source: "demo", loadedAt: "2026-11-05T08:00:00.000Z", requests, people };
}
