// Request Providing Company Uniform – "Đơn yêu cầu cấp / đổi bảo hộ" from an employee through the direct supervisor
// (selected sections only), the section manager, GA staff and the GA manager, then the requester confirms receipt.
// Stage keys, gateways and assignees follow the production BPMN (Uniform_Request v11, deployment 3739014, verified on
// iw_prod 2026-11-06); task keys of older versions are mapped to the same steps.
// This module must stay free of runtime imports: the unit tests evaluate it in isolation.

export const UNIFORM_PROCESS_KEY = "Uniform_Request";
export const UNIFORM_REJECT_ACTIVITY = "sid-10B6E118-AF00-4A0A-88E3-82A65C81B77E";
/** GA staff step is a candidate-group task: unclaimed tasks have no assignee. */
export const UNIFORM_GA_GROUP = "iw_ga";
/** GA manager step has a hard-coded assignee in the BPMN. */
export const UNIFORM_GA_MANAGER = "dung.nguyenxuan";
/** Sections routed through the direct supervisor before the section manager (BPMN gateway on Uniform_Section). */
export const UNIFORM_SUPERVISOR_SECTIONS = ["8511I", "8511L", "8512I", "8512J", "8511H", "8311H1", "3212H", "8311H2"];
export const UNIFORM_DUE_DAYS = 2;

export const UNIFORM_OPEN_STAGES = ["request", "supervisor", "manager", "gaStaff", "gaManager", "confirm"] as const;
/** Steps that only exist in older process versions (a few cases still wait there). */
export const UNIFORM_LEGACY_STAGES = ["gm", "gaGeneral"] as const;
export type UniformOpenStage = (typeof UNIFORM_OPEN_STAGES)[number];
export type UniformLegacyStage = (typeof UNIFORM_LEGACY_STAGES)[number];
export type UniformTaskStage = UniformOpenStage | UniformLegacyStage;
export type UniformStage = UniformTaskStage | "completed" | "rejected" | "cancelled" | "unknown";
export type UniformStatus = "open" | "completed" | "rejected" | "cancelled";
export const UNIFORM_STATUSES: UniformStatus[] = ["open", "completed", "rejected", "cancelled"];
export const UNIFORM_APPROVAL_STAGES: UniformTaskStage[] = ["supervisor", "manager", "gaStaff", "gaManager", "gm", "gaGeneral"];

export const UNIFORM_TASKS: Record<string, UniformTaskStage> = {
  "sid-241D48A2-F21B-49CA-8059-714205966A44": "request",
  QAMangerApprove: "supervisor",
  "sid-0DF6F9AA-CE7B-4AB7-9296-F767CECA420E": "supervisor",
  "sid-67946F2B-2CB2-4F8F-BBA4-57D2063FFC2E": "manager",
  "sid-3C1BBD3F-A1BD-416D-96E9-0A0D806A620D": "manager",
  "sid-6BA9DF00-7603-4BC6-910A-393E8F9FC98D": "manager",
  "sid-7935BB98-1934-42DB-814B-FAD9157F3D74": "gaStaff",
  "sid-FCEAF1E6-D9F3-4EA8-AE75-D406C4B9BBDB": "gaStaff",
  "sid-94253710-631E-4368-8B5E-F6878569AAC3": "gaStaff",
  "sid-C8EA4E61-79CB-4FFA-A3CA-69D48A225B31": "gaStaff",
  "sid-F9B8B0E0-3CA4-4099-8A5C-16AAC382F34C": "gaManager",
  "sid-7934CF2A-D3A7-49BC-BF8B-EF1AB6116715": "confirm",
  "sid-88BBC81B-FE55-4930-9D4D-FAC899E7FBC5": "gm",
  "sid-21A5E0C6-5F5B-44CA-A963-7EEC333343F7": "gm",
  "sid-8FC3D05B-23F7-41DA-B426-DDC09A25971C": "gm",
  "sid-947CA029-75FB-4D0C-802A-212E8CF7AAF3": "gaGeneral",
};

export type UniformRequestType = "new" | "oldForNew" | "newForNew" | "";
export const UNIFORM_REQUEST_TYPES = ["new", "oldForNew", "newForNew"] as const;
/** Enum values of the legacy "Uniform_Request" field. */
export const UNIFORM_TYPE_CODES: Record<string, Exclude<UniformRequestType, "">> = {
  Uniform_Prividenew: "new", Uniform_Oldbynew: "oldForNew", Uniform_Newbynew: "newForNew",
};

/** The ten garment rows of the eForm; variable names keep the original typos (New_TShirt_Short_Siz, Re_Joger_Size). */
export const UNIFORM_ITEMS = [
  { key: "shirtLong", returned: ["Re_Shirt_Long_Size", "Re_Shirt_Long_Qty"], issued: ["New_Shirt_Long_Size", "New_Shirt_Long_Qty"] },
  { key: "shirtShort", returned: ["Re_Shirt_Short_Size", "Re_Shirt_Short_Qty"], issued: ["New_Shirt_Short_Size", "New_Shirt_Short_Qty"] },
  { key: "tshirtLong", returned: ["Re_TShirt_Long_Size", "Re_TShirt_Long_Qty"], issued: ["New_TShirt_Long_Size", "New_TShirt_Long_Qty"] },
  { key: "tshirtShort", returned: ["Re_TShirt_Short_Size", "Re_TShirt_Short_Qty"], issued: ["New_TShirt_Short_Siz", "New_TShirt_Short_Qty"] },
  { key: "polo", returned: ["Re_Polo_Size", "Re_Polo_Qty"], issued: ["New_Polo_Size", "New_Polo_Qty"] },
  { key: "jacket", returned: ["Re_Jacket_Size", "Re_Jacket_Qty"], issued: ["New_Jacket_Size", "New_Jacket_Qty"] },
  { key: "pants", returned: ["Re_Pants_Size", "Re_Pants_Qty"], issued: ["New_Pants_Size", "New_Pants_Qty"] },
  { key: "cap", returned: ["Re_Cap_Size", "Re_Cap_Qty"], issued: ["New_Cap_Size", "New_Cap_Qty"] },
  { key: "jogger", returned: ["Re_Joger_Size", "Re_Jogger_Qty"], issued: ["New_Jogger_Size", "New_Jogger_Qty"] },
  { key: "simon", returned: ["Re_Simon_Size", "Re_Simon_Qty"], issued: ["New_Simon_Size", "New_Simon_Qty"] },
] as const;
export type UniformItemKey = (typeof UNIFORM_ITEMS)[number]["key"];
export type UniformLine = { size: string; qty: string };
export type UniformItem = { key: UniformItemKey; returned: UniformLine; issued: UniformLine };

export type UniformDecision = "submit" | "approve" | "revise" | "reject" | "confirm" | "";
export type UniformTaskStatus = "completed" | "pending" | "stopped";
export type UniformEvent = { at: string; actor: string; stage: UniformTaskStage | "unknown"; decision: UniformDecision; status: UniformTaskStatus; comment: string };
export type UniformPerson = { id: string; name: string; role?: "requester" | "supervisor" | "manager" | "gaStaff" | "gaManager"; section?: string };

export type UniformRequest = {
  id: string;
  code: string;
  department: string;
  section: string;
  sectionName: string;
  type: UniformRequestType;
  title: string;
  requestDate: string;
  reason: string;
  items: UniformItem[];
  gaConfirm: string;
  receiver: string;
  receivedDate: string;
  requester: string;
  supervisor: string;
  manager: string;
  stage: UniformStage;
  assignee: string;
  startedAt: string;
  dueAt: string;
  endedAt: string;
  endReason: string;
  lastActivityAt: string;
  history: UniformEvent[];
  attachments: { id: string; name: string; url?: string }[];
};

export type UniformSnapshot = { source: "demo" | "iw_prod"; loadedAt: string; requests: UniformRequest[]; people: UniformPerson[] };

const emptyLine = (): UniformLine => ({ size: "", qty: "" });
const lineFilled = (line: UniformLine) => !!(line.size.trim() || line.qty.trim());

/** All ten garment rows, filled from the given (sparse) item list. */
export function uniformItemRows(items: UniformItem[] = []): UniformItem[] {
  return UNIFORM_ITEMS.map(({ key }) => {
    const item = items.find((entry) => entry.key === key);
    return { key, returned: { ...(item?.returned ?? emptyLine()) }, issued: { ...(item?.issued ?? emptyLine()) } };
  });
}

/** Builds the item list from eForm variables, keeping only rows with a size or quantity. */
export function uniformItemsFrom(fields: Record<string, string | undefined>): UniformItem[] {
  const line = ([size, qty]: readonly [string, string]): UniformLine => ({ size: (fields[size] ?? "").trim(), qty: (fields[qty] ?? "").trim() });
  return UNIFORM_ITEMS.map(({ key, returned, issued }) => ({ key, returned: line(returned), issued: line(issued) }))
    .filter((item) => lineFilled(item.returned) || lineFilled(item.issued));
}

/** Quantities are free text in the legacy form ("1", "02", "1 đôi"); the first number counts. */
export function uniformQty(value: string) {
  const match = /\d+/.exec(value);
  return match ? Number(match[0]) : 0;
}

export function uniformTaskStatus(ended: boolean, reason: string | null): UniformTaskStatus {
  if (!ended) return "pending";
  const normalized = reason?.trim().toLowerCase();
  return normalized && normalized !== "completed" ? "stopped" : "completed";
}

/**
 * Maps the legacy eForm button (user_action.action) of a finished task to a decision. Revisions and most rejections
 * leave no button record, so approver steps without one are inferred from what followed: back to the request step
 * means revise, the reject end event means reject.
 */
export function uniformDecision(action: string | null | undefined, stage: UniformTaskStage | "unknown", following?: UniformStage): UniformDecision {
  if (action === "P4M_Button_PD" || action === "Uni_Direct_ConfirmOK") return "approve";
  if (action === "P4M_Button_TC" || action === "Uni_Direct_Reject") return "reject";
  if (action === "P4M_Button_YCCS" || action === "Uni_Direct_Return") return "revise";
  if (stage === "unknown") return "";
  if (stage === "request") return "submit";
  if (stage === "confirm") return "confirm";
  if (following === "request") return "revise";
  if (following === "rejected") return "reject";
  return action ? "" : "approve";
}

export function uniformStatus(request: Pick<UniformRequest, "stage">): UniformStatus {
  return request.stage === "completed" || request.stage === "rejected" || request.stage === "cancelled" ? request.stage : "open";
}

export function isUniformOverdue(request: UniformRequest, now: string) {
  return uniformStatus(request) === "open" && !!request.dueAt && Date.parse(request.dueAt) < Date.parse(now);
}

/** No task started or finished for more than a year (same definition as the abandoned-instances report). */
export function isUniformStale(request: UniformRequest, now: string) {
  return uniformStatus(request) === "open" && Date.parse(request.lastActivityAt || request.startedAt) < Date.parse(now) - 365 * 86400000;
}

export function uniformNeedsSupervisor(section: string) {
  return UNIFORM_SUPERVISOR_SECTIONS.includes(section.trim().toUpperCase());
}

export function uniformExpectedAssignee(request: Pick<UniformRequest, "requester" | "supervisor" | "manager">, stage: UniformStage) {
  if (stage === "request" || stage === "confirm") return request.requester;
  if (stage === "supervisor") return request.supervisor;
  if (stage === "manager") return request.manager;
  if (stage === "gaStaff") return UNIFORM_GA_GROUP;
  if (stage === "gaManager") return UNIFORM_GA_MANAGER;
  return "";
}

/** The assignee may act; an unclaimed GA staff task can be taken by any GA staff member. */
export function uniformCanAct(request: UniformRequest, actor: string, people: UniformPerson[]) {
  if (!actor || uniformStatus(request) !== "open") return false;
  if (actor === request.assignee) return true;
  return request.assignee === UNIFORM_GA_GROUP && request.stage === "gaStaff" && people.some((person) => person.id === actor && person.role === "gaStaff");
}

/** Steps of the current BPMN for this request; the supervisor step only applies to the gateway sections. */
export function uniformPath(request: Pick<UniformRequest, "section" | "history">): UniformOpenStage[] {
  const supervisor = uniformNeedsSupervisor(request.section) || request.history.some((event) => event.stage === "supervisor");
  return UNIFORM_OPEN_STAGES.filter((stage) => stage !== "supervisor" || supervisor);
}

/** Highest step index reached on {@link uniformPath}, used for the progress tracker. */
export function uniformReachedIndex(request: UniformRequest) {
  const path = uniformPath(request);
  if (request.stage === "completed") return path.length;
  const current = path.indexOf(request.stage as UniformOpenStage);
  if (current >= 0) return current;
  return Math.max(0, ...request.history.map((event) => path.indexOf(event.stage as UniformOpenStage)));
}

export function uniformPeriodStart(now: string, months: number) {
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

export function summarizeUniform(snapshot: UniformSnapshot, months: 3 | 6 | 12 = 12, department = "") {
  const now = Date.parse(snapshot.loadedAt);
  const since = uniformPeriodStart(snapshot.loadedAt, months);
  const selected = snapshot.requests.filter((request) => !department || request.department === department);
  const cohort = selected.filter((request) => Date.parse(request.startedAt) >= Date.parse(since) && Date.parse(request.startedAt) <= now);
  const withStatus = (list: UniformRequest[], status: UniformStatus) => list.filter((request) => uniformStatus(request) === status);
  const completed = withStatus(cohort, "completed");
  const open = withStatus(cohort, "open");
  const overdue = (request: UniformRequest) => isUniformOverdue(request, snapshot.loadedAt);
  const durations = completed.map((request) => (Date.parse(request.endedAt) - Date.parse(request.startedAt)) / DAY).filter((days) => Number.isFinite(days) && days >= 0);
  const start = new Date(since);
  const monthly = Array.from({ length: months + 1 }, (_, index) => {
    const month = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + index, 1));
    const key = month.toISOString().slice(0, 7);
    return { key, label: `${month.getUTCMonth() + 1}/${String(month.getUTCFullYear()).slice(-2)}`, value: cohort.filter((request) => request.startedAt.slice(0, 7) === key).length, secondary: completed.filter((request) => request.endedAt.slice(0, 7) === key).length };
  });
  const openStages = [...UNIFORM_OPEN_STAGES, ...UNIFORM_LEGACY_STAGES, "unknown"] as const;
  const backlog = withStatus(selected, "open").filter((request) => Date.parse(request.startedAt) <= now);
  const departments = [...new Set(selected.map((request) => request.department))].map((name) => {
    const started = cohort.filter((request) => request.department === name);
    const pending = withStatus(started, "open");
    return {
      name, started: started.length, completed: withStatus(started, "completed").length, pending: pending.length,
      overdue: pending.filter(overdue).length, backlog: backlog.filter((request) => request.department === name).length,
    };
  }).sort((left, right) => right.overdue - left.overdue || right.pending - left.pending || right.started - left.started || left.name.localeCompare(right.name));
  const approving = backlog.filter((request) => UNIFORM_APPROVAL_STAGES.includes(request.stage as UniformTaskStage));
  const approvers = [...new Set(approving.map((request) => request.assignee))].map((id) => {
    const waiting = approving.filter((request) => request.assignee === id);
    return { id, pending: waiting.length, overdue: waiting.filter(overdue).length };
  }).sort((left, right) => right.pending - left.pending || left.id.localeCompare(right.id));
  const aging = [
    { key: "7", value: backlog.filter((request) => ageDays(request.startedAt, now) <= 7).length },
    { key: "30", value: backlog.filter((request) => ageDays(request.startedAt, now) > 7 && ageDays(request.startedAt, now) <= 30).length },
    { key: "90", value: backlog.filter((request) => ageDays(request.startedAt, now) > 30 && ageDays(request.startedAt, now) <= 90).length },
    { key: "365", value: backlog.filter((request) => ageDays(request.startedAt, now) > 90 && ageDays(request.startedAt, now) <= 365).length },
    { key: "older", value: backlog.filter((request) => ageDays(request.startedAt, now) > 365).length },
  ];
  // Garments asked for by requests that were not rejected or cancelled.
  const demand = cohort.filter((request) => uniformStatus(request) === "open" || uniformStatus(request) === "completed");
  const items = UNIFORM_ITEMS.map(({ key }) => {
    const lines = demand.map((request) => request.items.find((item) => item.key === key)).filter((item): item is UniformItem => !!item);
    return {
      key, requests: lines.filter((item) => uniformQty(item.issued.qty) > 0).length,
      issued: lines.reduce((total, item) => total + uniformQty(item.issued.qty), 0), returned: lines.reduce((total, item) => total + uniformQty(item.returned.qty), 0),
    };
  }).sort((left, right) => right.issued - left.issued || right.requests - left.requests);
  const attention = open.filter(overdue).sort((left, right) => left.dueAt.localeCompare(right.dueAt) || left.startedAt.localeCompare(right.startedAt));
  return {
    since, cohort, started: cohort.length, completed: completed.length, pending: open.length, overdue: open.filter(overdue).length,
    rejected: withStatus(cohort, "rejected").length, cancelled: withStatus(cohort, "cancelled").length,
    completionRate: cohort.length ? completed.length / cohort.length * 100 : null,
    averageDays: durations.length ? durations.reduce((total, days) => total + days, 0) / durations.length : null,
    statuses: UNIFORM_STATUSES.map((status) => ({ status, value: withStatus(cohort, status).length })),
    stages: openStages.map((stage) => ({ stage, value: open.filter((request) => request.stage === stage).length })),
    types: [...UNIFORM_REQUEST_TYPES, ""].map((type) => ({ type: type as UniformRequestType, value: cohort.filter((request) => request.type === type).length })),
    items, monthly, departments, approvers, attention,
    backlog: backlog.length, backlogOverdue: backlog.filter(overdue).length,
    backlogStale: backlog.filter((request) => isUniformStale(request, snapshot.loadedAt)).length,
    backlogStages: openStages.map((stage) => ({ stage, value: backlog.filter((request) => request.stage === stage).length })),
    aging,
  };
}

export type DepartmentSortKey = "name" | "started" | "completed" | "pending" | "overdue" | "backlog";
export type DepartmentSort = { key: DepartmentSortKey; direction: "asc" | "desc" };

export function sortUniformDepartments(departments: ReturnType<typeof summarizeUniform>["departments"], sort: DepartmentSort | null) {
  if (!sort) return [...departments];
  return [...departments].sort((left, right) => {
    const comparison = sort.key === "name" ? left.name.localeCompare(right.name, "vi", { numeric: true }) : left[sort.key] - right[sort.key];
    return (sort.direction === "asc" ? comparison : -comparison) || left.name.localeCompare(right.name, "vi", { numeric: true });
  });
}

// ---------------------------------------------------------------------------------------------
// Demo workflow (mirrors the BPMN gateways; production data is never modified)
// ---------------------------------------------------------------------------------------------

/** Demo sections: FI (3212H) goes through the supervisor gateway, QA (3211) goes straight to the manager. */
export const UNIFORM_DEMO_SECTIONS = [{ code: "3212H", name: "FI" }, { code: "3211", name: "QA" }];

export type UniformRequestInput = {
  type: UniformRequestType; title: string; section: string; supervisor: string; requestDate: string; reason: string; items: UniformItem[];
};

export type UniformAction =
  | { type: "submit"; input: UniformRequestInput; comment?: string }
  | { type: "approve" | "revise" | "reject"; comment: string; gaConfirm?: string }
  | { type: "confirm"; comment?: string; receiver: string; receivedDate: string };

export const UNIFORM_ERRORS = {
  ended: "Hồ sơ đã kết thúc hoặc không thể xử lý.",
  actor: "Bạn không phải người xử lý bước hiện tại.",
  action: "Thao tác không phù hợp với bước hiện tại.",
  comment: "Vui lòng nhập ý kiến khi yêu cầu chỉnh sửa hoặc từ chối.",
  required: "Vui lòng chọn loại yêu cầu, bộ phận và nhập tiêu đề, lý do.",
  section: "Bộ phận chưa có người đại diện phê duyệt.",
  supervisor: "Vui lòng chọn Supervisor hợp lệ của bộ phận.",
  items: "Vui lòng nhập ít nhất một hạng mục bảo hộ xin cấp mới.",
  quantity: "Số lượng phải là số nguyên dương, đi kèm cỡ.",
  returned: "Yêu cầu đổi bảo hộ cần ghi hạng mục trả lại công ty.",
  gaConfirm: "Vui lòng nhập xác nhận của GA PIC.",
  receipt: "Vui lòng nhập người nhận và ngày nhận bảo hộ.",
} as const;

function sectionInfo(section: string, people: UniformPerson[]) {
  const code = section.trim().toUpperCase();
  const known = UNIFORM_DEMO_SECTIONS.find((entry) => entry.code === code);
  const manager = people.find((person) => person.role === "manager" && person.section === code);
  return { code, name: known?.name ?? code, manager: manager?.id ?? "" };
}

export function validateUniformInput(input: UniformRequestInput, requester: string, people: UniformPerson[]) {
  if (!input.type || ![input.title, input.section, input.reason].every((value) => value.trim())) throw new Error(UNIFORM_ERRORS.required);
  const section = sectionInfo(input.section, people);
  if (!section.manager || section.manager === requester) throw new Error(UNIFORM_ERRORS.section);
  if (uniformNeedsSupervisor(section.code)) {
    const supervisor = people.find((person) => person.id === input.supervisor);
    if (!supervisor || supervisor.role !== "supervisor" || supervisor.section !== section.code || supervisor.id === requester) throw new Error(UNIFORM_ERRORS.supervisor);
  }
  const lines = input.items.flatMap((item) => [item.returned, item.issued]).filter(lineFilled);
  if (lines.some((line) => !/^\d+$/.test(line.qty.trim()) || Number(line.qty) <= 0 || !line.size.trim())) throw new Error(UNIFORM_ERRORS.quantity);
  if (!input.items.some((item) => lineFilled(item.issued))) throw new Error(UNIFORM_ERRORS.items);
  if (input.type !== "new" && !input.items.some((item) => lineFilled(item.returned))) throw new Error(UNIFORM_ERRORS.returned);
}

function requestFields(input: UniformRequestInput, people: UniformPerson[]) {
  const section = sectionInfo(input.section, people);
  const trimLine = (line: UniformLine): UniformLine => ({ size: line.size.trim(), qty: line.qty.trim() });
  return {
    type: input.type, title: input.title.trim(), section: section.code, sectionName: section.name, department: section.name,
    supervisor: uniformNeedsSupervisor(section.code) ? input.supervisor : "", manager: section.manager,
    requestDate: input.requestDate, reason: input.reason.trim(),
    items: input.items.map((item) => ({ key: item.key, returned: trimLine(item.returned), issued: trimLine(item.issued) })).filter((item) => lineFilled(item.returned) || lineFilled(item.issued)),
  };
}

export function uniformInputFrom(request: UniformRequest): UniformRequestInput {
  return {
    type: request.type, title: request.title, section: request.section, supervisor: request.supervisor,
    requestDate: request.requestDate, reason: request.reason, items: uniformItemRows(request.items),
  };
}

function moveTo(request: UniformRequest, stage: UniformStage, now: string, closing: UniformEvent): UniformRequest {
  const history = [...request.history];
  const pending = history.findLastIndex((event) => event.status === "pending");
  if (pending >= 0) history[pending] = closing;
  else history.push(closing);
  const open = (UNIFORM_OPEN_STAGES as readonly string[]).includes(stage);
  const next = { ...request, stage, lastActivityAt: now };
  next.assignee = uniformExpectedAssignee(next, stage);
  if (open) {
    history.push({ at: now, actor: next.assignee, stage: stage as UniformOpenStage, decision: "", status: "pending", comment: "" });
    return { ...next, history, dueAt: new Date(Date.parse(now) + UNIFORM_DUE_DAYS * DAY).toISOString(), endedAt: "" };
  }
  return { ...next, history, assignee: "", dueAt: "", endedAt: now };
}

const NEXT_STAGE: Partial<Record<UniformOpenStage, UniformOpenStage>> = { supervisor: "manager", manager: "gaStaff", gaStaff: "gaManager", gaManager: "confirm" };

export function applyUniformAction(request: UniformRequest, action: UniformAction, actor: string, now: string, people: UniformPerson[]): UniformRequest {
  if (uniformStatus(request) !== "open" || !(UNIFORM_OPEN_STAGES as readonly string[]).includes(request.stage)) throw new Error(UNIFORM_ERRORS.ended);
  if (!uniformCanAct(request, actor, people)) throw new Error(UNIFORM_ERRORS.actor);
  const stage = request.stage as UniformOpenStage;
  const comment = (action.comment ?? "").trim();
  const close = (decision: UniformDecision): UniformEvent => ({ at: now, actor, stage, decision, status: "completed", comment });
  switch (stage) {
    case "request": {
      if (action.type !== "submit") throw new Error(UNIFORM_ERRORS.action);
      validateUniformInput(action.input, request.requester, people);
      const fields = requestFields(action.input, people);
      return moveTo({ ...request, ...fields }, uniformNeedsSupervisor(fields.section) ? "supervisor" : "manager", now, close("submit"));
    }
    case "confirm": {
      if (action.type !== "confirm") throw new Error(UNIFORM_ERRORS.action);
      const receiver = action.receiver.trim();
      if (!receiver || !action.receivedDate) throw new Error(UNIFORM_ERRORS.receipt);
      return moveTo({ ...request, receiver, receivedDate: action.receivedDate }, "completed", now, close("confirm"));
    }
    default: {
      if (action.type !== "approve" && action.type !== "revise" && action.type !== "reject") throw new Error(UNIFORM_ERRORS.action);
      if (action.type !== "approve" && !comment) throw new Error(UNIFORM_ERRORS.comment);
      if (action.type === "reject") return moveTo(request, "rejected", now, close("reject"));
      if (action.type === "revise") return moveTo(request, "request", now, close("revise"));
      if (stage !== "gaStaff") return moveTo(request, NEXT_STAGE[stage]!, now, close("approve"));
      const gaConfirm = (action.gaConfirm ?? "").trim();
      if (!gaConfirm) throw new Error(UNIFORM_ERRORS.gaConfirm);
      return moveTo({ ...request, gaConfirm }, "gaManager", now, close("approve"));
    }
  }
}

export function createUniformRequest(input: UniformRequestInput, requester: string, now: string, snapshot: UniformSnapshot): UniformRequest {
  validateUniformInput(input, requester, snapshot.people);
  const fields = requestFields(input, snapshot.people);
  const year = now.slice(0, 4);
  const prefix = `${fields.department}-${year}-`;
  const sequence = Math.max(0, ...snapshot.requests.filter((request) => request.code.startsWith(prefix)).map((request) => Number(request.code.slice(prefix.length)) || 0)) + 1;
  const id = `uni-demo-${Math.max(0, ...snapshot.requests.map((request) => Number(request.id.replace(/\D/g, "")) || 0)) + 1}`;
  const draft: UniformRequest = {
    ...fields, id, code: `${prefix}${String(sequence).padStart(3, "0")}`, gaConfirm: "", receiver: "", receivedDate: "",
    requester, stage: "request", assignee: requester, startedAt: now, dueAt: "", endedAt: "", endReason: "", lastActivityAt: now,
    history: [], attachments: [],
  };
  return moveTo(draft, uniformNeedsSupervisor(fields.section) ? "supervisor" : "manager", now, { at: now, actor: requester, stage: "request", decision: "submit", status: "completed", comment: "" });
}

export function buildUniformDemo(): UniformSnapshot {
  const people: UniformPerson[] = [
    { id: "uni-op-fi", name: "Nguyễn Văn An · FI Operator", role: "requester", section: "3212H" },
    { id: "uni-op-qa", name: "Trần Thị Bình · QA Inspector", role: "requester", section: "3211" },
    { id: "uni-sup-fi", name: "Lê Quốc Minh · FI Supervisor", role: "supervisor", section: "3212H" },
    { id: "uni-mgr-fi", name: "Alex Morgan · FI Manager", role: "manager", section: "3212H" },
    { id: "uni-mgr-qa", name: "Jordan Lee · QA Manager", role: "manager", section: "3211" },
    { id: "uni-ga-1", name: "Phạm Thu Hoa · GA Staff", role: "gaStaff" },
    { id: "uni-ga-2", name: "Đỗ Thành Long · GA Staff", role: "gaStaff" },
    { id: UNIFORM_GA_MANAGER, name: "Vũ Hải Nam · GA Manager", role: "gaManager" },
  ];
  const line = (size = "", qty = ""): UniformLine => ({ size, qty });
  const item = (key: UniformItemKey, issued: UniformLine, returned: UniformLine = line()): UniformItem => ({ key, returned, issued });
  type Seed = {
    stage: UniformStage; section: "3212H" | "3211"; started: string; type: Exclude<UniformRequestType, "">; title: string; reason: string; items: UniformItem[];
    ending?: { decision: "revise" | "reject"; at: UniformOpenStage; comment: string };
  };
  const seeds: Seed[] = [
    { stage: "supervisor", section: "3212H", started: "2026-11-04T01:00:00.000Z", type: "oldForNew", title: "Đổi quần và giày Jogger", reason: "Quần rách gối, giày Jogger mòn đế sau 12 tháng sử dụng", items: [item("pants", line("L", "2"), line("L", "2")), item("jogger", line("41", "1"), line("41", "1"))] },
    { stage: "manager", section: "3211", started: "2026-10-30T02:00:00.000Z", type: "new", title: "Cấp bảo hộ cho nhân viên mới", reason: "Nhân viên mới vào làm từ 01/11/2026", items: [item("shirtLong", line("M", "2")), item("pants", line("M", "2")), item("simon", line("39", "1")), item("cap", line("Mũ mềm", "1"))] },
    { stage: "manager", section: "3212H", started: "2026-11-03T03:00:00.000Z", type: "oldForNew", title: "Đổi áo sơ mi dài tay", reason: "Áo bạc màu, sờn cổ", items: [item("shirtLong", line("XL", "2"), line("XL", "2"))] },
    { stage: "gaStaff", section: "3212H", started: "2026-10-28T02:00:00.000Z", type: "oldForNew", title: "Đổi giày Jogger", reason: "Giày bong keo mũi", items: [item("jogger", line("42", "1"), line("42", "1"))] },
    { stage: "gaManager", section: "3211", started: "2026-11-02T02:00:00.000Z", type: "newForNew", title: "Đổi cỡ áo khoác", reason: "Áo khoác cấp mới không vừa cỡ", items: [item("jacket", line("L", "1"), line("M", "1"))] },
    { stage: "confirm", section: "3212H", started: "2026-10-20T02:00:00.000Z", type: "oldForNew", title: "Đổi quần bảo hộ", reason: "Quần rách do va chạm máy", items: [item("pants", line("XL", "1"), line("XL", "1")), item("polo", line("XL", "1"), line("XL", "1"))] },
    { stage: "confirm", section: "3211", started: "2025-06-10T02:00:00.000Z", type: "oldForNew", title: "Đổi giày Simon", reason: "Giày hỏng mũi thép", items: [item("simon", line("40", "1"), line("40", "1"))] },
    { stage: "completed", section: "3211", started: "2026-10-01T02:00:00.000Z", type: "oldForNew", title: "Đổi áo phông dài tay", reason: "Áo cũ sờn tay", items: [item("tshirtLong", line("L", "2"), line("L", "2"))] },
    { stage: "rejected", section: "3212H", started: "2026-10-12T02:00:00.000Z", type: "oldForNew", title: "Đổi mũ cứng", reason: "Mũ trầy xước", items: [item("cap", line("Mũ cứng", "1"), line("Mũ cứng", "1"))], ending: { decision: "reject", at: "gaStaff", comment: "Chưa đủ thời gian sử dụng tối thiểu (12 tháng), không đủ điều kiện đổi." } },
    { stage: "request", section: "3211", started: "2026-11-01T02:00:00.000Z", type: "oldForNew", title: "Đổi áo phông ngắn tay", reason: "Áo bạc màu", items: [item("tshirtShort", line("M", "2"), line("M", "2"))], ending: { decision: "revise", at: "manager", comment: "Bổ sung ảnh chụp tình trạng áo cũ." } },
  ];
  const requests = seeds.map((seed, index): UniformRequest => {
    const requester = seed.section === "3212H" ? "uni-op-fi" : "uni-op-qa";
    const base = { requester, supervisor: seed.section === "3212H" ? "uni-sup-fi" : "", manager: seed.section === "3212H" ? "uni-mgr-fi" : "uni-mgr-qa" };
    const path = uniformPath({ section: seed.section, history: [] });
    const target = seed.ending ? path.indexOf(seed.ending.at) + 1 : seed.stage === "completed" ? path.length : path.indexOf(seed.stage as UniformOpenStage);
    const history: UniformEvent[] = [];
    let at = Date.parse(seed.started);
    let gaActor = "";
    for (let step = 0; step < target; step += 1) {
      at += 0.6 * DAY;
      const ending = seed.ending && step === target - 1 ? seed.ending : undefined;
      const stage = path[step];
      const actor = stage === "gaStaff" ? (gaActor = "uni-ga-1") : uniformExpectedAssignee(base, stage);
      history.push({ at: new Date(at).toISOString(), actor, stage, decision: ending?.decision ?? (stage === "request" ? "submit" : stage === "confirm" ? "confirm" : "approve"), status: "completed", comment: ending?.comment ?? "" });
    }
    const open = (UNIFORM_OPEN_STAGES as readonly string[]).includes(seed.stage);
    if (open) history.push({ at: new Date(at).toISOString(), actor: uniformExpectedAssignee(base, seed.stage), stage: seed.stage as UniformOpenStage, decision: "", status: "pending", comment: "" });
    const sectionName = UNIFORM_DEMO_SECTIONS.find((section) => section.code === seed.section)!.name;
    const confirmed = !!gaActor && seed.stage !== "rejected";
    const requesterName = people.find((person) => person.id === requester)!.name.split(" · ")[0];
    return {
      id: `uni-demo-${index + 1}`, code: `${sectionName}-${seed.started.slice(0, 4)}-${String(310 + index).padStart(3, "0")}`, department: sectionName,
      section: seed.section, sectionName, type: seed.type, title: seed.title, requestDate: seed.started.slice(0, 10), reason: seed.reason, items: seed.items,
      gaConfirm: confirmed ? `Đủ điều kiện cấp đổi cho ${requesterName}, đã kiểm tra hàng trả lại.` : "",
      receiver: seed.stage === "completed" ? requesterName : "", receivedDate: seed.stage === "completed" ? new Date(at).toISOString().slice(0, 10) : "",
      ...base, stage: seed.stage, assignee: open ? uniformExpectedAssignee(base, seed.stage) : "", startedAt: seed.started,
      dueAt: open ? new Date(at + UNIFORM_DUE_DAYS * DAY).toISOString() : "", endedAt: open ? "" : new Date(at).toISOString(), endReason: "",
      lastActivityAt: new Date(at).toISOString(), history, attachments: [],
    };
  });
  return { source: "demo", loadedAt: "2026-11-05T08:00:00.000Z", requests, people };
}
