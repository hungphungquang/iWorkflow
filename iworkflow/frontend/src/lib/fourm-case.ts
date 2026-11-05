// 4M case model on top of the BPMN simulation engine in fourm.ts: one record per Process4MChange instance,
// with form data, open tasks, audit trail, comments and sharing. Pure functions only – the store persists them.

import { initialSim, riskFields, sectionByCode, simReducer, stepById, TPPC, type EndState, type FourMStepId, type SimState } from "./fourm";
import { GD_ID, gmOf, managerOf, people, personById, personName } from "./people";

export const PROCESS_KEY = "Process4MChange";
export const PROCESS_NAME = "Before 4M Change";
export const LATEST_VERSION = 12;
export const NOW0 = "2026-11-03T02:00:00.000Z"; // 09:00 giờ Việt Nam

export type YN = "Y" | "N" | "";
export type RelatedRow = { code: string; risk: YN; std: YN; initial: YN; cancel: YN; opinion: string };
export type ResultData = { actualDate: string; haveProb: YN; content: string; measure: string };
export type RequestData = {
  title: string;
  processText: string;
  classes: string[];
  situation: string;
  detail: string;
  purpose: string;
  expectedDate: string;
  rows: RelatedRow[];
};

export type CaseEvent = {
  id: number;
  at: string;
  actor: string;
  kind: "create" | "submit" | "decision" | "staff" | "comment" | "share" | "edit" | "attach";
  step?: FourMStepId;
  section?: string;
  decision?: string;
  label: string;
  comment?: string;
  emails?: string[];
};
export type Comment = { id: number; at: string; by: string; text: string; mentions: string[] };
export type Share = { at: string; by: string; to: string[]; emails: string[]; note: string };
/** `id` is set only when the file content can be fetched from /api/4m/attachments/{id} (iw_prod). */
export type Attachment = { id?: string; name: string; size: string; by: string; at: string };

export type FourMCase = RequestData & {
  code: string;
  version: number;
  requester: string;
  section: string;
  ehs: Record<string, string>;
  result: ResultData;
  attachments: Attachment[];
  sim: SimState;
  stepSince: string;
  runSince: Record<string, string>;
  staffDone: Record<string, string[]>;
  staffNotes: Record<string, string>;
  createdAt: string;
  updatedAt: string;
  endedAt?: string;
  /** When phase 1 (request approval) finished and phase 2 (Process4MChangeResult) started. */
  phase2At?: string;
  events: CaseEvent[];
  comments: Comment[];
  shares: Share[];
  watchers: string[];
  /** iw_prod read-only mode: Activiti process instance id and the real open tasks (assignees from ACT_HI_TASKINST). */
  prodId?: string;
  prodTasks?: OpenTask[];
};

export type CaseState = "running" | EndState;
export type NoteKind = "task" | "returned" | "share" | "mention" | "update" | "ended";
export type Note = { id: string; to: string; at: string; code: string; kind: NoteKind; text: string; read: boolean };
export type NewNote = Omit<Note, "id" | "read">;

export type CaseAction =
  | { type: "resubmit"; data: RequestData; comment?: string }
  | { type: "decide"; value: string; comment: string }
  | { type: "section"; code: string; value: string; comment: string; yn?: Partial<Pick<RelatedRow, "risk" | "std" | "initial" | "cancel">>; staff?: string[] }
  | { type: "staffDone"; code: string; note: string }
  | { type: "result"; result: ResultData; comment?: string }
  | { type: "review"; comment?: string }
  | { type: "comment"; text: string }
  | { type: "share"; to: string[]; emails: string[]; note: string; email: boolean }
  | { type: "watch"; on: boolean }
  | { type: "ehs"; values: Record<string, string> }
  | { type: "attach"; name: string; size: string }
  | { type: "remind"; note: string };

// ---------------------------------------------------------------------------------------------
// Time & SLA
// ---------------------------------------------------------------------------------------------

const HOUR = 3_600_000;
export const addHours = (iso: string, h: number) => new Date(new Date(iso).getTime() + h * HOUR).toISOString();
export const hoursBetween = (a: string, b: string) => (new Date(b).getTime() - new Date(a).getTime()) / HOUR;

export const slaDays: Record<FourMStepId, number> = { create: 3, mgr: 2, gm: 2, relsec: 2, gd: 3, result: 7, rmgr: 2, rgm: 2, rrelsec: 2, rgd: 3, review: 2 };
export const STAFF_SLA_DAYS = 3;

export type DueStatus = "overdue" | "dueSoon" | "normal";
export function dueStatus(due: string, now: string): DueStatus {
  const left = hoursBetween(now, due);
  if (left < 0) return "overdue";
  if (left < 24) return "dueSoon";
  return "normal";
}

// ---------------------------------------------------------------------------------------------
// Labels
// ---------------------------------------------------------------------------------------------

export const stepShort: Record<FourMStepId, string> = {
  create: "Tạo yêu cầu",
  mgr: "TP kiểm tra",
  gm: "GM phê duyệt",
  relsec: "Phòng liên quan thẩm định",
  gd: "TGĐ quyết định",
  result: "Nhập kết quả",
  rmgr: "TP kiểm tra KQ",
  rgm: "GM duyệt KQ",
  rrelsec: "Phòng liên quan xác nhận KQ",
  rgd: "TGĐ quyết định (KQ)",
  review: "Xác nhận hoàn thành",
};

export const stateLabel: Record<CaseState, string> = { running: "Đang xử lý", completed: "Hoàn tất", rejected: "Từ chối", cancelled: "Đã hủy" };
export const stateTone: Record<CaseState, "blue" | "green" | "red" | "gray"> = { running: "blue", completed: "green", rejected: "red", cancelled: "gray" };

export const sectionShort = (code: string) => sectionByCode(code)?.name.split(" –")[0] ?? code;
export const sectionLabel = (code: string) => {
  const s = sectionByCode(code);
  return s ? `${s.code} ${s.name.split(" –")[0]}` : code;
};

export const caseState = (c: FourMCase): CaseState => c.sim.ended ?? "running";
export const phaseOf = (c: FourMCase) => (c.sim.step ? stepById(c.sim.step).phase : c.sim.visited.includes("result") ? "after" : "before");

/**
 * Running cases that passed phase 1 but have not finished phase 2:
 * "todo" = result never submitted yet (waiting at "Nhập kết quả"), "doing" = result submitted and in review (or returned for correction).
 */
export type Phase2Status = "todo" | "doing";
export function phase2Status(c: FourMCase): Phase2Status | null {
  if (caseState(c) !== "running" || !c.sim.step || stepById(c.sim.step).phase !== "after") return null;
  return c.sim.step === "result" && !c.sim.visited.includes("rmgr") ? "todo" : "doing";
}
/** Days since phase 2 started (falls back to the current step's start for data saved before `phase2At` existed). */
export const phase2Days = (c: FourMCase, now: string) => Math.max(0, hoursBetween(c.phase2At ?? c.stepSince, now) / 24);

export const PHASE2_AGES = [
  { id: "30", label: "≤ 30 ngày", labelEn: "≤ 30 days", max: 30 },
  { id: "90", label: "31–90 ngày", labelEn: "31–90 days", max: 90 },
  { id: "180", label: "91–180 ngày", labelEn: "91–180 days", max: 180 },
  { id: "365", label: "181–365 ngày", labelEn: "181–365 days", max: 365 },
  { id: "old", label: "> 1 năm", labelEn: "> 1 year", max: Infinity },
] as const;
export type Phase2Age = (typeof PHASE2_AGES)[number]["id"];
export const phase2AgeOf = (days: number): Phase2Age => PHASE2_AGES.find((b) => days <= b.max)!.id;

export function runProgress(c: FourMCase) {
  const runs = c.sim.runs;
  return { done: runs.filter((r) => r.status === "approved").length, total: runs.length };
}

export function currentStepLabel(c: FourMCase) {
  if (!c.sim.step) return stateLabel[caseState(c)];
  if (c.sim.step === "relsec" || c.sim.step === "rrelsec") {
    const p = runProgress(c);
    return `${stepShort[c.sim.step]} (${p.done}/${p.total})`;
  }
  return stepShort[c.sim.step];
}

export function decisionLabel(value: string) {
  for (const s of ["mgr", "relsec", "gd"] as const) {
    const d = stepById(s).decisions?.find((x) => x.value === value);
    if (d) return d.label;
  }
  return value;
}

// ---------------------------------------------------------------------------------------------
// Open tasks (who must act now)
// ---------------------------------------------------------------------------------------------

export type TaskKind = "main" | "section" | "staff" | "recheck";
export type OpenTask = { id: string; code: string; step: FourMStepId; kind: TaskKind; section?: string; assignee: string; since: string; due: string };

export const taskKindLabel: Record<TaskKind, string> = { main: "", section: "Trưởng phòng thẩm định", staff: "Cán bộ kiểm tra", recheck: "TP duyệt lại sau cán bộ" };

export function openTasks(c: FourMCase): OpenTask[] {
  if (c.prodTasks) return c.prodTasks;
  const step = c.sim.step;
  if (!step) return [];
  const mk = (kind: TaskKind, assignee: string, since: string, days: number, section?: string): OpenTask => ({
    id: [c.code, step, kind, section ?? "", assignee, since].join("|"),
    code: c.code,
    step,
    kind,
    section,
    assignee,
    since,
    due: addHours(since, days * 24),
  });
  switch (step) {
    case "create":
    case "review":
      return [mk("main", c.requester, c.stepSince, slaDays[step])];
    case "result": {
      // SLA for entering results follows the expected change date, not the moment the task was created.
      const t = mk("main", c.requester, c.stepSince, 0);
      const expectedDue = addHours(`${c.expectedDate}T10:00:00.000Z`, slaDays.result * 24);
      return [{ ...t, due: expectedDue > c.stepSince ? expectedDue : addHours(c.stepSince, slaDays.result * 24) }];
    }
    case "mgr":
    case "rmgr":
      return [mk("main", managerOf(c.section), c.stepSince, slaDays[step])];
    case "gm":
    case "rgm":
      return [mk("main", gmOf(c.section), c.stepSince, slaDays[step])];
    case "gd":
    case "rgd":
      return [mk("main", GD_ID, c.stepSince, slaDays[step])];
    case "relsec":
    case "rrelsec":
      return c.sim.runs.flatMap((r) => {
        const since = c.runSince[r.code] ?? c.stepSince;
        if (r.status === "pending") return [mk("section", managerOf(r.code), since, slaDays[step], r.code)];
        if (r.status === "recheck") return [mk("recheck", managerOf(r.code), since, slaDays[step], r.code)];
        if (r.status === "staff") {
          const done = c.staffDone[r.code] ?? [];
          return r.staff.filter((p) => !done.includes(p)).map((p) => mk("staff", p, since, STAFF_SLA_DAYS, r.code));
        }
        return [];
      });
  }
}

export function participants(c: FourMCase): string[] {
  const ids = new Set<string>([c.requester, ...c.events.map((e) => e.actor), ...openTasks(c).map((t) => t.assignee), ...c.watchers]);
  c.shares.forEach((s) => s.to.forEach((p) => ids.add(p)));
  c.sim.runs.forEach((r) => r.staff.forEach((p) => ids.add(p)));
  return [...ids];
}

export const sharedWith = (c: FourMCase, me: string) => c.shares.some((s) => s.to.includes(me));

// ---------------------------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------------------------

function autoActor(c: FourMCase, a: CaseAction): string {
  if (a.type === "section") return managerOf(a.code);
  if (a.type === "resubmit" || a.type === "result" || a.type === "review") return c.requester;
  if (a.type === "decide") return openTasks(c)[0]?.assignee ?? c.requester;
  return c.requester;
}

const emailOf = (id: string) => personById(id)?.email ?? id;

export function applyCase(c: FourMCase, a: CaseAction, actor: string, at: string): { next: FourMCase; notes: NewNote[] } {
  const before = openTasks(c);
  const step = c.sim.step ?? undefined;
  const notes: NewNote[] = [];
  let n: FourMCase = { ...c, updatedAt: at };
  const ev = (e: Omit<CaseEvent, "id" | "at" | "actor">) => {
    n = { ...n, events: [...n.events, { id: n.events.length + 1, at, actor, ...e }] };
  };

  switch (a.type) {
    case "resubmit": {
      n = { ...n, ...a.data };
      const sim = simReducer(c.sim, { type: "setRelated", codes: a.data.rows.map((r) => r.code) });
      n.sim = simReducer(sim, { type: "submit" });
      ev({ kind: "submit", step, label: "Gửi lại yêu cầu sau chỉnh sửa", comment: a.comment });
      break;
    }
    case "decide": {
      n.sim = simReducer(c.sim, { type: "decide", value: a.value });
      ev({ kind: "decision", step, decision: a.value, label: decisionLabel(a.value), comment: a.comment });
      break;
    }
    case "section": {
      n.rows = c.rows.map((r) => (r.code === a.code ? { ...r, ...a.yn, opinion: a.comment || r.opinion } : r));
      n.sim = simReducer(c.sim, { type: "section", code: a.code, value: a.value, staff: a.staff });
      const label = TPPC.find((d) => d.value === a.value)?.label ?? a.value;
      const staff = a.staff?.length ? ` → ${a.staff.map(personName).join(", ")}` : "";
      ev({ kind: "decision", step, section: a.code, decision: a.value, label: `${label}${staff}`, comment: a.comment });
      break;
    }
    case "staffDone": {
      const done = [...(c.staffDone[a.code] ?? []), actor];
      n.staffDone = { ...c.staffDone, [a.code]: done };
      n.staffNotes = { ...c.staffNotes, [`${a.code}:${actor}`]: a.note };
      ev({ kind: "staff", step, section: a.code, label: "Cán bộ hoàn thành kiểm tra", comment: a.note });
      const run = c.sim.runs.find((r) => r.code === a.code);
      if (run && run.staff.every((p) => done.includes(p))) n.sim = simReducer(c.sim, { type: "staffDone", code: a.code });
      break;
    }
    case "result": {
      n.result = a.result;
      n.sim = simReducer(c.sim, { type: "submit" });
      ev({ kind: "submit", step, label: "Gửi kết quả thực hiện thay đổi", comment: a.comment });
      break;
    }
    case "review": {
      n.sim = simReducer(c.sim, { type: "review" });
      ev({ kind: "decision", step, label: "Xác nhận hoàn thành", comment: a.comment });
      break;
    }
    case "comment": {
      const mentions = extractMentions(a.text);
      n.comments = [...c.comments, { id: c.comments.length + 1, at, by: actor, text: a.text, mentions }];
      mentions.filter((m) => m !== actor).forEach((to) => notes.push({ to, at, code: c.code, kind: "mention", text: `${personName(actor)} nhắc đến bạn trong trao đổi` }));
      break;
    }
    case "share": {
      n.shares = [...c.shares, { at, by: actor, to: a.to, emails: a.emails, note: a.note }];
      n.watchers = [...new Set([...c.watchers, ...a.to])];
      const emails = a.email ? [...a.to.map(emailOf), ...a.emails] : a.emails;
      ev({ kind: "share", label: `Chia sẻ cho ${[...a.to.map(personName), ...a.emails].join(", ")}`, comment: a.note, emails });
      a.to.filter((p) => p !== actor).forEach((to) => notes.push({ to, at, code: c.code, kind: "share", text: `${personName(actor)} chia sẻ hồ sơ với bạn${a.note ? `: “${a.note}”` : ""}` }));
      break;
    }
    case "watch":
      n.watchers = a.on ? [...new Set([...c.watchers, actor])] : c.watchers.filter((w) => w !== actor);
      break;
    case "ehs":
      n.ehs = { ...c.ehs, ...a.values };
      ev({ kind: "edit", step, label: "EHS cập nhật đánh giá rủi ro pháp lý" });
      break;
    case "attach":
      n.attachments = [...c.attachments, { name: a.name, size: a.size, by: actor, at }];
      ev({ kind: "attach", step, label: `Đính kèm ${a.name}` });
      break;
    case "remind": {
      const holders = [...new Set(before.map((t) => t.assignee))].filter((p) => p !== actor);
      ev({ kind: "share", step, label: `Nhắc việc ${holders.map(personName).join(", ")}`, comment: a.note, emails: holders.map(emailOf) });
      holders.forEach((to) => notes.push({ to, at, code: c.code, kind: "task", text: `${personName(actor)} nhắc bạn xử lý${a.note ? `: “${a.note}”` : ""}` }));
      break;
    }
  }

  if (n.sim !== c.sim) {
    if (n.sim.step !== c.sim.step || n.sim.round !== c.sim.round) n.stepSince = at;
    if (n.sim.round !== c.sim.round) {
      n.staffDone = {};
      n.runSince = Object.fromEntries(n.sim.runs.map((r) => [r.code, at]));
    } else {
      const since = { ...c.runSince };
      n.sim.runs.forEach((r) => {
        if (c.sim.runs.find((x) => x.code === r.code)?.status !== r.status) since[r.code] = at;
      });
      n.runSince = since;
    }
    if (n.sim.ended && !c.sim.ended) n.endedAt = at;
    if (!n.phase2At && n.sim.visited.includes("result") && !c.sim.visited.includes("result")) n.phase2At = at;

    const after = openTasks(n);
    const fresh = after.filter((t) => !before.some((b) => b.id === t.id));
    const returned = fresh.some((t) => t.step === "create" || t.step === "result") && (step !== "create" && step !== "result");
    fresh.forEach((t) =>
      notes.push({ to: t.assignee, at, code: c.code, kind: returned ? "returned" : "task", text: returned ? `Hồ sơ được trả lại: ${stepShort[t.step]}` : `Việc mới: ${stepShort[t.step]}${t.section ? ` – ${sectionShort(t.section)}` : ""}` }),
    );
    const mailTo = [...new Set(fresh.map((t) => emailOf(t.assignee)))];
    if (n.sim.ended) {
      [c.requester, ...c.watchers].filter((p) => p !== actor).forEach((to) => notes.push({ to, at, code: c.code, kind: "ended", text: `Hồ sơ đã kết thúc: ${stateLabel[n.sim.ended!]}` }));
      mailTo.push(emailOf(c.requester));
    }
    if (mailTo.length && n.events.length) {
      const last = n.events[n.events.length - 1];
      n.events = [...n.events.slice(0, -1), { ...last, emails: [...(last.emails ?? []), ...mailTo] }];
    }
    c.watchers
      .filter((w) => w !== actor && !fresh.some((t) => t.assignee === w) && !n.sim.ended)
      .forEach((to) => notes.push({ to, at, code: c.code, kind: "update", text: `Hồ sơ bạn theo dõi chuyển sang: ${currentStepLabel(n)}` }));
  }
  return { next: n, notes };
}

export function extractMentions(text: string): string[] {
  return people.filter((p) => text.includes(`@${p.name}`)).map((p) => p.id);
}

export function nextCode(cases: FourMCase[], section: string, at: string) {
  const prefix = `${sectionShort(section)}-${at.slice(0, 4)}-`;
  const max = cases.filter((c) => c.code.startsWith(prefix)).reduce((m, c) => Math.max(m, Number(c.code.slice(prefix.length)) || 0), 0);
  return `${prefix}${String(max + 1).padStart(3, "0")}`;
}

export const emptyResult: ResultData = { actualDate: "", haveProb: "", content: "", measure: "" };
export const emptyEhs = () => Object.fromEntries(riskFields.map((f) => [f.code, ""]));
export const emptyRow = (code: string): RelatedRow => ({ code, risk: "", std: "", initial: "", cancel: "", opinion: "" });

export function createCase(input: { data: RequestData; requester: string; section: string; attachments?: string[] }, code: string, at: string, version = LATEST_VERSION) {
  const sim0 = initialSim(input.section, input.data.rows.map((r) => r.code));
  const base: FourMCase = {
    ...input.data,
    code,
    version,
    requester: input.requester,
    section: input.section,
    ehs: emptyEhs(),
    result: { ...emptyResult },
    attachments: (input.attachments ?? []).map((name) => ({ name, size: "—", by: input.requester, at })),
    sim: sim0,
    stepSince: at,
    runSince: {},
    staffDone: {},
    staffNotes: {},
    createdAt: at,
    updatedAt: at,
    events: [{ id: 1, at, actor: input.requester, kind: "create", step: "create", label: `Tạo hồ sơ (${PROCESS_KEY} v${version})` }],
    comments: [],
    shares: [],
    watchers: [],
  };
  const sim = simReducer(sim0, { type: "submit" });
  const next: FourMCase = { ...base, sim, stepSince: at, events: [...base.events, { id: 2, at, actor: input.requester, kind: "submit", step: "create", label: `Gửi yêu cầu (${input.data.rows.length} phòng liên quan)`, emails: [emailOf(managerOf(input.section))] }] };
  const notes: NewNote[] = openTasks(next).map((t) => ({ to: t.assignee, at, code, kind: "task", text: `Việc mới: ${stepShort[t.step]}` }));
  return { next, notes };
}

// ---------------------------------------------------------------------------------------------
// Full-text search across every form field, opinions, comments and attachment names.
// Accent-insensitive so "con lan" finds "con lăn".
// ---------------------------------------------------------------------------------------------

export function fold(s: string) {
  let out = "";
  for (const ch of s.normalize("NFC").split("")) {
    const b = ch.normalize("NFD")[0];
    out += b === "đ" || b === "Đ" ? "d" : b;
  }
  return out.toLowerCase();
}

export type SearchHit = { field: string; parts: { text: string; hit: boolean }[] };

export function caseFields(c: FourMCase): { field: string; text: string }[] {
  const f = [
    { field: "Mã hồ sơ", text: c.code },
    { field: "Tiêu đề", text: c.title },
    { field: "Quy trình", text: `${PROCESS_NAME} ${PROCESS_KEY} 4M Change` },
    { field: "4M Process", text: c.processText },
    { field: "Current Situation", text: c.situation },
    { field: "Detail of Change", text: c.detail },
    { field: "Purpose", text: c.purpose },
    { field: "Người đề nghị", text: `${personName(c.requester)} · ${sectionLabel(c.section)}` },
    { field: "Phân loại", text: c.classes.join(", ") },
    { field: "Phòng liên quan", text: c.rows.map((r) => sectionLabel(r.code)).join(", ") },
    { field: "Problem content", text: c.result.content },
    { field: "Measure", text: c.result.measure },
  ];
  c.rows.forEach((r) => r.opinion && f.push({ field: `Ý kiến ${sectionShort(r.code)}`, text: r.opinion }));
  Object.entries(c.staffNotes).forEach(([k, v]) => v && f.push({ field: `Ý kiến cán bộ ${personName(k.split(":")[1])}`, text: v }));
  riskFields.forEach((rf) => c.ehs[rf.code] && f.push({ field: `EHS · ${rf.label}`, text: c.ehs[rf.code] }));
  c.events.forEach((e) => e.comment && f.push({ field: `Ý kiến xử lý · ${personName(e.actor)}`, text: e.comment }));
  c.comments.forEach((m) => f.push({ field: `Trao đổi · ${personName(m.by)}`, text: m.text }));
  c.attachments.forEach((a) => f.push({ field: "Tệp đính kèm", text: a.name }));
  return f.filter((x) => x.text);
}

export function searchCase(c: FourMCase, q: string): SearchHit[] | null {
  const terms = fold(q).split(/\s+/).filter(Boolean);
  if (!terms.length) return [];
  const fields = caseFields(c).map((x) => ({ ...x, text: x.text.normalize("NFC"), folded: fold(x.text) }));
  if (!terms.every((t) => fields.some((x) => x.folded.includes(t)))) return null;
  const hits: SearchHit[] = [];
  for (const x of fields) {
    const first = Math.min(...terms.map((t) => x.folded.indexOf(t)).filter((i) => i >= 0));
    if (!Number.isFinite(first)) continue;
    const start = Math.max(0, first - 40);
    const end = Math.min(x.text.length, first + 120);
    const mark = new Array(end - start).fill(false);
    for (const t of terms) {
      for (let i = x.folded.indexOf(t, start); i >= 0 && i < end; i = x.folded.indexOf(t, i + 1)) {
        for (let k = i; k < Math.min(i + t.length, end); k++) mark[k - start] = true;
      }
    }
    const parts: SearchHit["parts"] = [];
    if (start > 0) parts.push({ text: "…", hit: false });
    for (let k = 0; k < mark.length; k++) {
      const last = parts[parts.length - 1];
      const ch = x.text[start + k];
      if (last && last.hit === mark[k] && !(k === 0 && start > 0)) last.text += ch;
      else parts.push({ text: ch, hit: mark[k] });
    }
    if (end < x.text.length) parts.push({ text: "…", hit: false });
    hits.push({ field: x.field, parts });
  }
  return hits;
}

// ---------------------------------------------------------------------------------------------
// Seed data – built by replaying real actions so every state is reachable and consistent.
// ---------------------------------------------------------------------------------------------

type Script = [when: string, action: CaseAction, actor?: string][];
const at = (md: string) => {
  const [d, t = "09:00"] = md.split(" ");
  return new Date(`2026-${d}T${t}:00+07:00`).toISOString();
};
const PD = "P4M_Button_PD";
const sec = (code: string, value = "Button_4M_TPXL_PD", comment = "", yn: Partial<RelatedRow> = { risk: "N", std: "N", initial: "N", cancel: "N" }): CaseAction => ({ type: "section", code, value, comment, yn });
const ok = (comment = ""): CaseAction => ({ type: "decide", value: PD, comment });
const result = (r: Partial<ResultData> = {}): CaseAction => ({ type: "result", result: { actualDate: "2026-10-01", haveProb: "N", content: "", measure: "", ...r } });

type SeedDef = {
  code: string;
  version: number;
  requester: string;
  section: string;
  created: string;
  data: Omit<RequestData, "rows"> & { rows: string[] };
  attachments?: string[];
  script: Script;
};

function seedCase(d: SeedDef) {
  const rows = d.data.rows.map(emptyRow);
  let { next: c } = createCase({ data: { ...d.data, rows }, requester: d.requester, section: d.section, attachments: d.attachments }, d.code, at(d.created), d.version);
  for (const [when, action, actor] of d.script) c = applyCase(c, action, actor ?? autoActor(c, action), at(when)).next;
  return c;
}

const seeds: SeedDef[] = [
  {
    code: "ENG-2026-341", version: 12, requester: "bao", section: "8311", created: "10-21 08:30",
    data: {
      title: "Thay đổi 4M – máy cán số 3 (thay con lăn dẫn hướng)",
      processText: "Thay đổi vật tư con lăn từ thép C45 sang SUS304, cập nhật tiêu chuẩn vận hành",
      classes: ["Q", "S"],
      situation: "Con lăn hiện tại mòn nhanh (3 tháng/lần), gây xước bề mặt bán thành phẩm.",
      detail: "Thay 4 con lăn dẫn hướng bằng vật liệu SUS304, điều chỉnh khe hở 0,2 mm, cập nhật WS-CAN-03.",
      purpose: "Giảm lỗi xước bề mặt 60%, kéo dài chu kỳ bảo trì lên 12 tháng.",
      expectedDate: "2026-12-15",
      rows: ["3221", "3211", "8411", "8511"],
    },
    attachments: ["BanVe_ConLan_RevC.pdf", "WS-CAN-03_draft.docx"],
    script: [
      ["10-22 10:00", ok("Đồng ý, lưu ý cập nhật WS trước ngày áp dụng.")],
      ["10-22 10:05", ok()],
      ["10-23 14:00", sec("8411", "Button_4M_TPXL_PD", "TS không có ý kiến, cần cập nhật bản vẽ chuẩn.", { risk: "N", std: "Y", initial: "N", cancel: "N" })],
      ["10-24 08:15", { type: "comment", text: "Đã bổ sung bản vẽ rev.C, nhờ @Võ Thanh Tùng xem giúp phần dung sai." }, "bao"],
      ["11-02 09:30", { type: "section", code: "3211", value: "Button_4M_TPXL_PC", comment: "Giao cán bộ QA kiểm tra mẫu thử.", yn: { risk: "Y", std: "Y", initial: "Y", cancel: "N" }, staff: ["anh"] }],
    ],
  },
  {
    code: "ENG-2026-344", version: 12, requester: "linh", section: "8311", created: "11-02 15:10",
    data: {
      title: "Thay dầu thủy lực máy ép lưu hóa PCR từ ISO VG46 sang VG68",
      processText: "Bảo dưỡng hệ thủy lực máy lưu hóa PCR line 2",
      classes: ["Q", "C"],
      situation: "Nhiệt độ dầu vượt 65°C vào mùa nóng, độ nhớt VG46 giảm làm rò rỉ phớt.",
      detail: "Thay toàn bộ dầu thủy lực sang ISO VG68, thay phớt xi lanh chính, điều chỉnh áp suất 0,5 MPa.",
      purpose: "Giảm rò rỉ dầu, giảm dừng máy ngoài kế hoạch 30%.",
      expectedDate: "2026-12-01",
      rows: ["3211", "8514"],
    },
    attachments: ["TDS_Dau_VG68.pdf"],
    script: [],
  },
  {
    code: "IT-2026-018", version: 12, requester: "hoa", section: "1511", created: "10-28 09:00",
    data: {
      title: "Nâng cấp PLC dây chuyền đùn từ S7-300 lên S7-1500",
      processText: "Hệ thống điều khiển dây chuyền đùn (extruder) – Machine",
      classes: ["Q", "D"],
      situation: "PLC S7-300 đã ngừng sản xuất, linh kiện thay thế khó mua, 2 lần dừng máy trong quý 3.",
      detail: "Thay CPU, module I/O, chuyển chương trình sang TIA Portal; chạy song song 2 ca trước khi chuyển hẳn.",
      purpose: "Đảm bảo khả năng bảo trì, giảm rủi ro dừng dây chuyền.",
      expectedDate: "2026-11-20",
      rows: ["8511", "8514", "3211"],
    },
    script: [["10-29 08:00", ok("Đồng ý, cần kế hoạch rollback.")]],
  },
  {
    code: "ENG-2026-329", version: 11, requester: "bao", section: "8311", created: "09-15 10:00",
    data: {
      title: "Thay đổi nhà cung cấp than đen N330",
      processText: "Nguyên liệu trộn – Material",
      classes: ["Q", "C"],
      situation: "Nhà cung cấp hiện tại tăng giá 12%, thời gian giao hàng 8 tuần.",
      detail: "Chuyển sang nhà cung cấp mới đã đạt đánh giá phòng thí nghiệm; chạy thử 3 mẻ Banbury.",
      purpose: "Giảm chi phí nguyên liệu 7%, rút ngắn lead time xuống 4 tuần.",
      expectedDate: "2026-10-25",
      rows: ["3221", "3211"],
    },
    script: [
      ["09-16 09:00", ok()],
      ["09-16 09:10", ok()],
      ["09-25 15:00", sec("3221", "Button_4M_TPXL_PD", "Không phát sinh chất thải mới.")],
      ["10-05 11:00", sec("3211", "Button_4M_TPXL_PD", "Đạt kết quả thử nghiệm 3 mẻ.", { risk: "N", std: "Y", initial: "Y", cancel: "N" })],
    ],
  },
  {
    code: "ENG-2026-317", version: 11, requester: "linh", section: "8311", created: "08-20 13:30",
    data: {
      title: "Thay đổi phương pháp kiểm tra độ cứng cao su",
      processText: "Phòng thí nghiệm – Method",
      classes: ["Q"],
      situation: "Đo độ cứng Shore A thủ công, sai số giữa người đo đến ±3.",
      detail: "Chuyển sang máy đo độ cứng tự động có giá đỡ, ghi dữ liệu vào hệ thống LIMS.",
      purpose: "Giảm sai số đo xuống ±1, truy xuất dữ liệu tự động.",
      expectedDate: "2026-10-15",
      rows: ["3221", "3211"],
    },
    script: [
      ["08-21 09:00", ok()],
      ["08-21 09:05", ok()],
      ["08-28 10:00", sec("3221")],
      ["09-10 16:00", sec("3211", "Button_4M_TPXL_PD", "", { risk: "N", std: "Y", initial: "N", cancel: "N" })],
      ["10-28 14:00", result({ actualDate: "2026-10-20" })],
      ["10-29 08:30", ok()],
      ["10-29 08:35", ok()],
      ["10-30 10:00", sec("3211", "Button_4M_TPXL_PD", "Xác nhận dữ liệu LIMS ổn định.")],
    ],
  },
  {
    code: "ENG-2026-336", version: 12, requester: "bao", section: "8311", created: "10-15 09:00",
    data: {
      title: "Thay khuôn lưu hóa 17 inch – tăng số lỗ thoát khí",
      processText: "Khuôn lưu hóa lốp PCR 17 inch – Machine",
      classes: ["Q", "D"],
      situation: "Tỷ lệ lỗi bọt khí (air trap) ở vai lốp 1,8%.",
      detail: "Gia công thêm 24 lỗ thoát khí trên khuôn, chạy song song 2 khuôn trong tháng 11.",
      purpose: "Giảm lỗi air trap xuống dưới 0,5%.",
      expectedDate: "2026-11-30",
      rows: ["3211", "8511", "3221"],
    },
    script: [
      ["10-16 08:00", ok()],
      ["10-16 08:05", ok()],
      ["10-20 10:00", sec("3211", "Button_4M_TPXL_PD", "", { risk: "N", std: "Y", initial: "Y", cancel: "N" })],
      ["10-27 15:30", sec("8511", "Button_4M_TPXL_TC", "Không đủ nhân lực vận hành song song 2 khuôn trong tháng 11, đề nghị dời sang tháng 1.", { risk: "N", std: "N", initial: "N", cancel: "Y" })],
    ],
  },
  {
    code: "TS-2026-021", version: 12, requester: "hai", section: "8411", created: "10-30 10:00",
    data: {
      title: "Giảm nhiệt độ cài đặt máy cán tráng (calender) từ 85°C xuống 80°C",
      processText: "Cán tráng vải mành – Method",
      classes: ["Q", "E"],
      situation: "Hiện tượng cháy sớm (scorch) ở mép tấm cán vào ca chiều.",
      detail: "Giảm nhiệt độ cuộn 2 và 3 từ 85°C xuống 80°C, tăng tốc độ 3%.",
      purpose: "Giảm lỗi scorch, tiết kiệm năng lượng hơi.",
      expectedDate: "2026-11-25",
      rows: ["3211", "8511"],
    },
    script: [["10-31 14:00", { type: "decide", value: "P4M_Button_YCCS", comment: "Bổ sung kế hoạch thử nghiệm và số lượng mẫu đánh giá." }]],
  },
  {
    code: "ENG-2026-301", version: 11, requester: "bao", section: "8311", created: "08-01 09:00",
    data: {
      title: "Thay đổi vật liệu đệm dao máy cắt bead",
      processText: "Máy cắt bead – Material",
      classes: ["C"],
      situation: "Đệm dao bằng nhựa POM mòn sau 2 tuần.",
      detail: "Chuyển sang đệm PU 95A, thay đổi chu kỳ kiểm tra từ hằng ngày sang hằng tuần.",
      purpose: "Giảm chi phí vật tư 40%.",
      expectedDate: "2026-09-01",
      rows: ["3211", "8411"],
    },
    script: [
      ["08-02 09:00", ok()],
      ["08-02 09:05", ok()],
      ["08-05 10:00", sec("3211")],
      ["08-06 10:00", sec("8411")],
      ["09-20 09:00", result({ actualDate: "2026-09-03" })],
      ["09-21 09:00", ok()],
      ["09-21 09:05", ok()],
      ["09-24 10:00", sec("3211")],
      ["09-25 10:00", sec("8411")],
      ["10-20 08:00", { type: "review", comment: "Đã áp dụng ổn định." }],
    ],
  },
  {
    code: "ENG-2026-288", version: 10, requester: "linh", section: "8311", created: "06-10 09:00",
    data: {
      title: "Thay động cơ băng tải tanh (bead) bằng servo",
      processText: "Băng tải tanh máy thành hình – Machine",
      classes: ["D", "S"],
      situation: "Động cơ AC cũ khởi động giật, gây lệch tanh.",
      detail: "Lắp servo 1,5 kW, encoder tuyệt đối, điều chỉnh tăng tốc mềm.",
      purpose: "Giảm lỗi lệch tanh, tăng tốc độ băng tải.",
      expectedDate: "2026-08-01",
      rows: ["8511", "8514", "3211"],
    },
    script: [
      ["06-11 09:00", ok()],
      ["06-11 09:05", ok()],
      ["06-14 10:00", sec("8511")],
      ["06-15 10:00", sec("8514")],
      ["06-18 10:00", sec("3211")],
      ["08-10 09:00", result({ actualDate: "2026-08-05", haveProb: "Y", content: "Rung động tăng nhẹ ở tốc độ trên 40 m/phút", measure: "Giới hạn tốc độ 38 m/phút, lắp thêm giảm chấn cao su ở chân đế." })],
      ["08-11 09:00", ok()],
      ["08-11 09:05", ok()],
      ["08-20 10:00", sec("8511")],
      ["08-22 10:00", sec("8514")],
      ["08-25 10:00", sec("3211")],
      ["09-05 08:00", { type: "review" }],
    ],
  },
  {
    code: "ENG-2026-295", version: 11, requester: "bao", section: "8311", created: "07-15 09:00",
    data: {
      title: "Bỏ công đoạn kiểm tra trực quan sau lưu hóa",
      processText: "Kiểm tra cuối – Method",
      classes: ["C"],
      situation: "Công đoạn kiểm tra trực quan trùng với máy kiểm tra X-ray.",
      detail: "Bỏ trạm kiểm tra trực quan số 2.",
      purpose: "Giảm 2 nhân sự mỗi ca.",
      expectedDate: "2026-08-15",
      rows: ["3211", "3212H"],
    },
    script: [["07-20 10:00", { type: "decide", value: "P4M_Button_TC", comment: "Không đồng ý, X-ray không phát hiện lỗi ngoại quan bề mặt." }]],
  },
  {
    code: "IT-2026-009", version: 10, requester: "hoa", section: "1511", created: "05-20 09:00",
    data: {
      title: "Thay máy quét mã vạch bằng RFID tại kho thành phẩm",
      processText: "Kho thành phẩm – Machine",
      classes: ["D", "C"],
      situation: "Quét mã vạch thủ công chậm, sai sót 0,3%.",
      detail: "Lắp cổng RFID tại 4 cửa xuất, dán tag cho pallet.",
      purpose: "Giảm thời gian xuất hàng 50%.",
      expectedDate: "2026-07-15",
      rows: ["3211", "8511"],
    },
    script: [
      ["05-21 09:00", ok()],
      ["05-22 09:00", ok()],
      ["06-02 10:00", sec("3211", "Button_4M_TPXL_TC", "Tag RFID chưa được khách hàng OEM chấp thuận.")],
      ["06-12 10:00", { type: "decide", value: "Button_4M_KT", comment: "Dừng, chờ OEM phê duyệt tiêu chuẩn tag." }],
    ],
  },
  {
    code: "ENG-2026-339", version: 12, requester: "bao", section: "8311", created: "09-01 09:00",
    data: {
      title: "Thay đổi vị trí lắp cảm biến nhiệt khuôn",
      processText: "Máy lưu hóa TBR – Machine",
      classes: ["Q"],
      situation: "Cảm biến nhiệt đặt gần cửa hơi, đo sai lệch 4°C.",
      detail: "Dời cảm biến vào giữa khuôn, đi lại dây tín hiệu chống nhiễu.",
      purpose: "Kiểm soát nhiệt độ lưu hóa chính xác hơn.",
      expectedDate: "2026-10-10",
      rows: ["3211", "8514"],
    },
    script: [
      ["09-02 09:00", ok()],
      ["09-02 09:05", ok()],
      ["09-05 10:00", sec("3211")],
      ["09-08 10:00", sec("8514")],
      ["10-20 09:00", result({ actualDate: "2026-10-12" })],
      ["10-21 09:00", ok()],
      ["10-21 09:05", ok()],
      ["10-30 10:00", sec("3211")],
      ["11-02 10:00", sec("8514")],
    ],
  },
  {
    code: "QA-2026-044", version: 12, requester: "anh", section: "3211", created: "10-27 09:00",
    data: {
      title: "Thay đổi tần suất lấy mẫu kiểm tra hợp chất trộn",
      processText: "Kiểm tra hợp chất sau Banbury – Method",
      classes: ["Q"],
      situation: "Lấy mẫu mỗi mẻ, tải phòng thí nghiệm quá cao.",
      detail: "Lấy mẫu 1/3 mẻ cho hợp chất ổn định (Cpk ≥ 1,67), giữ mỗi mẻ cho hợp chất mới.",
      purpose: "Giảm 40% tải phòng thí nghiệm, giữ nguyên mức kiểm soát.",
      expectedDate: "2026-11-30",
      rows: ["8311", "8511", "3221"],
    },
    script: [
      ["10-27 15:00", ok()],
      ["10-28 09:00", ok()],
      ["10-29 10:00", { type: "section", code: "8511", value: "Button_4M_TPXL_PC", comment: "Giao cán bộ SX1 đánh giá ảnh hưởng ca.", yn: { risk: "N", std: "Y", initial: "N", cancel: "N" }, staff: ["quan"] }],
      ["10-30 10:00", sec("3221")],
    ],
  },
  {
    code: "ENG-2026-347", version: 12, requester: "linh", section: "8311", created: "09-10 09:00",
    data: {
      title: "Thay đổi chu trình bảo dưỡng máy trộn Banbury",
      processText: "Máy trộn Banbury số 1 – Method",
      classes: ["D", "C"],
      situation: "Bảo dưỡng định kỳ 2 tuần/lần làm dừng máy 8 giờ.",
      detail: "Chuyển sang bảo dưỡng theo tình trạng (rung, nhiệt độ ổ bi) với cảm biến IoT.",
      purpose: "Giảm thời gian dừng máy 50%.",
      expectedDate: "2026-10-25",
      rows: ["8514", "3211"],
    },
    script: [
      ["09-11 09:00", ok()],
      ["09-11 09:05", ok()],
      ["09-15 10:00", sec("8514")],
      ["09-16 10:00", sec("3211")],
      ["11-03 08:00", result({ actualDate: "2026-10-28", haveProb: "Y", content: "Cảm biến rung báo động giả 3 lần trong tuần đầu", measure: "Hiệu chỉnh ngưỡng cảnh báo từ 4,5 lên 6 mm/s." })],
    ],
  },
];

export function buildSeed(): { cases: FourMCase[]; notes: NewNote[] } {
  const cases = seeds.map(seedCase);
  const shareCase = cases.find((c) => c.code === "ENG-2026-336")!;
  const shared = applyCase(shareCase, { type: "share", to: ["son", "sato"], emails: ["qc.supervisor@btmv.vn"], note: "SX1 từ chối do thiếu nhân lực – nhờ anh Sơn và Plant Manager trao đổi trước khi TGĐ quyết định.", email: true }, "bao", at("10-28 08:00"));
  cases[cases.indexOf(shareCase)] = shared.next;
  const notes: NewNote[] = [...shared.notes];
  cases.forEach((c) => openTasks(c).forEach((t) => notes.push({ to: t.assignee, at: t.since, code: c.code, kind: "task", text: `Việc mới: ${stepShort[t.step]}${t.section ? ` – ${sectionShort(t.section)}` : ""}` })));
  return { cases, notes };
}
