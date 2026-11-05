// Read-only snapshot of the real 4M process family from iw_prod (Activiti 5 + iWorkflow tables), mapped onto the
// FourMCase model the new UI uses. Every session runs with default_transaction_read_only=on; nothing is written.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Pool } from "pg";
import { addHours, slaDays, STAFF_SLA_DAYS, type Attachment, type CaseEvent, type Comment, type FourMCase, type OpenTask, type RelatedRow, type TaskKind, type YN } from "../fourm-case";
import type { EndState, FourMStepId, LogEntry, Section, SectionRun, SectionRunStatus } from "../fourm";
import type { Person } from "../people";

export type ProdSnapshot = {
  source: "iw_prod";
  loadedAt: string;
  now: string;
  defaultMe: string;
  cases: FourMCase[];
  people: Person[];
  org: Record<string, { manager: string; gm: string; staff: string[] }>;
  sections: Section[];
};

// ---------------------------------------------------------------------------------------------
// Connection (password from IW_DB_PASSWORD or the user's pgpass.conf, as used by the phase0 scripts)
// ---------------------------------------------------------------------------------------------

const cfg = () => ({
  host: process.env.IW_DB_HOST ?? "10.118.29.21",
  port: Number(process.env.IW_DB_PORT ?? 5432),
  database: process.env.IW_DB_NAME ?? "iw_prod",
  user: process.env.IW_DB_USER ?? "iworkflow",
});

function pgpassPassword(host: string, port: number, db: string, user: string): string | undefined {
  // turbopackIgnore: runtime-only path outside the project; keeps Turbopack from tracing/watching it.
  const file =
    process.env.PGPASSFILE ??
    (process.platform === "win32"
      ? path.join(/*turbopackIgnore: true*/ process.env.APPDATA ?? "", "postgresql", "pgpass.conf")
      : path.join(/*turbopackIgnore: true*/ os.homedir(), ".pgpass"));
  if (!fs.existsSync(/*turbopackIgnore: true*/ file)) return undefined;
  for (const raw of fs.readFileSync(/*turbopackIgnore: true*/ file, "utf8").split(/\r?\n/)) {
    const parts = raw.split(":");
    if (parts.length < 5 || raw.startsWith("#")) continue;
    const [h, p, d, u] = parts;
    const ok = (v: string, want: string) => v === "*" || v === want;
    if (ok(h, host) && ok(p, String(port)) && ok(d, db) && ok(u, user)) return parts.slice(4).join(":");
  }
  return undefined;
}

let pool: Pool | null = null;
function getPool() {
  if (pool) return pool;
  const c = cfg();
  const password = process.env.IW_DB_PASSWORD ?? pgpassPassword(c.host, c.port, c.database, c.user);
  if (!password) throw new Error(`Không tìm thấy mật khẩu cho ${c.user}@${c.host}/${c.database} (IW_DB_PASSWORD hoặc pgpass.conf)`);
  pool = new Pool({
    ...c,
    password,
    max: 4,
    idleTimeoutMillis: 30_000,
    application_name: "iworkflow-4m-ui-readonly",
    options: "-c default_transaction_read_only=on -c statement_timeout=120000",
  });
  return pool;
}

// ---------------------------------------------------------------------------------------------
// Process model constants (task_def_key_ values verified on iw_prod)
// ---------------------------------------------------------------------------------------------

const K_ROOT = "Process4MChange";
const K_REL = "RelSecProc_2510";
const K_RES = "Process4MChangeResult";
const K_RREL = "RelSecProcResult";
const CREATE_KEY = "sid-A6406A5A-DEC2-4064-AB06-102B2F504EFF";

const mainStep: Record<string, Record<string, FourMStepId>> = {
  [K_ROOT]: { [CREATE_KEY]: "create", ManagerApprove: "mgr", GeneralApprove: "gm", "sid-D310FEED-856A-4543-A324-4BF9F78671DC": "gd" },
  [K_RES]: {
    [CREATE_KEY]: "result",
    "sid-EB41ABE7-E323-45F8-B432-485F72EA988C": "rmgr",
    "sid-5FB83087-5740-4E41-91C3-417B5213594E": "rgm",
    "sid-5B8186AB-B0B2-4CCE-A5F2-3BBB5FD895AF": "rgd",
    "print-finish": "review",
  },
};
type OpenRunStatus = "pending" | "staff" | "recheck";
const sectionTask: Record<string, Record<string, OpenRunStatus>> = {
  [K_REL]: { ManagerCheckRequest: "pending", "sid-2C21CB23-CAD0-425B-A356-F306BA6438D8": "staff", "sid-3D9A5C01-1A6D-4381-B8AF-39C8FEEB22D3": "recheck" },
  [K_RREL]: { "sid-F1BB36A3-78A1-4D10-91B5-0BACB542AB09": "pending", "sid-2C21CB23-CAD0-425B-A356-F306BA6438D8": "staff", "sid-3D9A5C01-1A6D-4381-B8AF-39C8FEEB22D3": "recheck" },
};
const kindOf: Record<OpenRunStatus, TaskKind> = { pending: "section", staff: "staff", recheck: "recheck" };
const RESULT_STEPS: FourMStepId[] = ["result", "rmgr", "rgm", "rgd", "review"];

// ---------------------------------------------------------------------------------------------
// Row types
// ---------------------------------------------------------------------------------------------

type ProcRow = { id: string; key: string; version: number; parent: string | null; start: Date; end: Date | null; deleteReason: string | null; startUser: string | null };
type TaskRow = { id: string; proc: string; key: string; name: string; assignee: string | null; start: Date; end: Date | null; deleteReason: string | null };
type VarRow = { proc: string; name: string; text: string | null; long: string | null; bytes: string | null };
type CommentRow = { proc: string; task: string | null; by: string; at: Date; text: string | null };
type AttachRow = { id: string; proc: string; name: string; type: string | null; by: string; at: Date; size: number | null };
type ActionRow = { proc: string; task: string | null; by: string; action: string; label: string | null; at: Date };
type UnitRow = { id: string; ma: string; ten: string; parent: string | null; manager: string | null; gm: string | null; status: number };

const iso = (d: Date | null | undefined) => (d ? d.toISOString() : "");
const attachmentName = (a: { name: string; type: string | null }) =>
  a.type && !a.name.toLowerCase().endsWith(`.${a.type.toLowerCase()}`) ? `${a.name}.${a.type}` : a.name;
const day = (s: string | undefined) => {
  if (!s) return "";
  const t = s.trim();
  let out = "";
  let m = /^(\d{4})-(\d{2})-(\d{2})/.exec(t);
  if (m) out = `${m[1]}-${m[2]}-${m[3]}`;
  else if ((m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})/.exec(t))) out = `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  else {
    const d = new Date(t);
    out = Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
  }
  return out && !Number.isNaN(Date.parse(`${out}T00:00:00Z`)) ? out : "";
};
const stamp = (d: Date) => iso(d).slice(0, 16).replace("T", " ");

// ---------------------------------------------------------------------------------------------
// CORE#DATA form XML (<hoso><truongthongtin ma=".." giatrichu=".."/><nhom ma=".." thutu="n">..</nhom></hoso>)
// ---------------------------------------------------------------------------------------------

type FormGroup = { ma: string; order: number; fields: Record<string, string> };
type FormData = { fields: Record<string, string>; groups: FormGroup[] };

const decodeXml = (s: string) =>
  s
    .replace(/&#x([0-9a-f]+);/gi, (_, h: string) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d: string) => String.fromCodePoint(Number(d)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");

export function parseCore(xml: string | undefined): FormData {
  const out: FormData = { fields: {}, groups: [] };
  if (!xml) return out;
  // longString values come back as a Java-serialised String: skip the header bytes before <hoso>.
  const start = xml.indexOf("<hoso");
  if (start < 0) return out;
  const attrs = (tag: string) => {
    const a: Record<string, string> = {};
    for (const m of tag.matchAll(/(\w+)="([^"]*)"/g)) a[m[1]] = decodeXml(m[2]);
    return a;
  };
  const stack: FormGroup[] = [];
  for (const m of xml.slice(start).matchAll(/<(\/?)(nhom|truongthongtin)\b([^>]*?)\/?>/g)) {
    const [whole, close, tag, rest] = m;
    if (tag === "nhom") {
      if (close) {
        const g = stack.pop();
        if (g && stack.length === 0) out.groups.push(g);
      } else {
        const a = attrs(rest);
        const g = { ma: a.ma ?? "", order: Number(a.thutu ?? 0), fields: {} };
        if (whole.endsWith("/>")) {
          if (stack.length === 0) out.groups.push(g);
        } else stack.push(g);
      }
      continue;
    }
    const a = attrs(rest);
    if (!a.ma) continue;
    const value = a.giatrichu ?? a.giatringay ?? a.giatriso ?? a.giatri ?? "";
    // Nested groups (e.g. RiskAssessment_BMC inside a related-section row) are flattened into the top-level group.
    if (stack.length === 0) out.fields[a.ma] = value;
    else stack[0].fields[stack.length === 1 ? a.ma : `${stack[stack.length - 1].ma}.${a.ma}`] = value;
  }
  return out;
}

const yn = (v: string | undefined): YN => (v === "Y" || v === "N" ? v : "");
const parseClasses = (v: string | undefined) =>
  (v ?? "")
    .replace(/[[\]]/g, "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

// ---------------------------------------------------------------------------------------------
// Loading
// ---------------------------------------------------------------------------------------------

const VAR_NAMES = [
  "CORE#DATA", "init", "P4MForm_NguoiDN", "P4MForm_DonVi", "P4M_PBXL_PB", "P4M_PBXL_PB_RS", "dataLoopPath",
  "P4M_Button_PDTC", "Button_4M_TPPC", "Button_4M_XL", "P4M_CBXL_ND",
];

async function loadRaw() {
  const db = getPool();
  const since = process.env.IW_PROD_SINCE ?? "2000-01-01";

  const procs = (
    await db.query(
      `with recursive fam as (
         select p.id_, p.proc_def_id_, p.super_process_instance_id_, p.start_time_, p.end_time_, p.delete_reason_, p.start_user_id_
           from act_hi_procinst p join act_re_procdef d on d.id_ = p.proc_def_id_
          where d.key_ = $1 and p.start_time_ >= $2::timestamp
         union all
         select c.id_, c.proc_def_id_, c.super_process_instance_id_, c.start_time_, c.end_time_, c.delete_reason_, c.start_user_id_
           from act_hi_procinst c join fam f on c.super_process_instance_id_ = f.id_
       )
       select f.id_ as id, d.key_ as key, d.version_ as version, f.super_process_instance_id_ as parent, f.start_time_ as start,
              f.end_time_ as "end", f.delete_reason_ as "deleteReason", f.start_user_id_ as "startUser"
         from fam f join act_re_procdef d on d.id_ = f.proc_def_id_`,
      [K_ROOT, since],
    )
  ).rows as ProcRow[];
  const ids = procs.map((p) => p.id);
  const rootIds = procs.filter((p) => p.key === K_ROOT).map((p) => p.id);

  const [tasks, vars, codes, comments, attachments, actions, units, members, names] = await Promise.all([
    db.query(
      `select id_ as id, proc_inst_id_ as proc, task_def_key_ as key, name_ as name, assignee_ as assignee, start_time_ as start, end_time_ as "end", delete_reason_ as "deleteReason"
         from act_hi_taskinst where proc_inst_id_ = any($1::text[]) order by start_time_, id_`,
      [ids],
    ),
    db.query(
      `select v.proc_inst_id_ as proc, v.name_ as name, v.text_ as text, v.long_::text as long,
              case when v.var_type_ = 'longString' then b.bytes_ end as bytes
         from act_hi_varinst v left join act_ge_bytearray b on b.id_ = v.bytearray_id_ and v.var_type_ = 'longString'
        where v.proc_inst_id_ = any($1::text[]) and v.execution_id_ = v.proc_inst_id_ and v.name_ = any($2::text[])`,
      [ids, VAR_NAMES],
    ),
    db.query(
      `select distinct on (proc_inst_id) proc_inst_id as proc, code_first as first, code_last as last
         from procinst_info where proc_inst_id = any($1::text[]) order by proc_inst_id, id desc`,
      [rootIds],
    ),
    db.query(
      `select proc_inst_id_ as proc, task_id_ as task, user_id_ as "by", time_ as at, message_ as text, full_msg_ as "full"
         from act_hi_comment where proc_inst_id_ = any($1::text[]) and type_ = 'comment' order by time_`,
      [ids],
    ),
    db.query(
      `select a.id_ as id, a.proc_inst_id_ as proc, a.name_ as name, a.type_ as type, a.user_id_ as "by", a.time_ as at, length(b.bytes_) as size
         from act_hi_attachment a left join act_ge_bytearray b on b.id_ = a.content_id_
        where a.proc_inst_id_ = any($1::text[]) order by a.time_`,
      [ids],
    ),
    db.query(
      `select procinst_id as proc, task_id as task, user_name as "by", action, action_name as label, action_date as at
         from user_action where procinst_id = any($1::text[]) order by action_date`,
      [ids],
    ),
    db.query(`select id::text, ma, ten, ht_donvi_id::text as parent, nguoi_dai_dien as manager, lanh_dao_dai_dien as gm, trang_thai::int as status from ht_donvi`),
    db.query(`select ten_dang_nhap as username, ht_donvi_id::text as unit from ht_nguoidung_chucvu order by id`),
    db.query(
      `select distinct on (user_name) user_name as username, full_name as name from user_action
        where full_name is not null and full_name <> '' order by user_name, action_date desc`,
    ),
  ]);

  return {
    procs,
    tasks: tasks.rows as TaskRow[],
    vars: (vars.rows as (Omit<VarRow, "bytes"> & { bytes: Buffer | null })[]).map((v) => ({ ...v, bytes: v.bytes ? v.bytes.toString("utf8") : null })),
    codes: codes.rows as { proc: string; first: string | null; last: string | null }[],
    comments: (comments.rows as (CommentRow & { full: Buffer | null })[]).map(({ full, ...c }) => ({ ...c, text: full?.length ? full.toString("utf8") : c.text })),
    attachments: attachments.rows as AttachRow[],
    actions: actions.rows as ActionRow[],
    units: units.rows as UnitRow[],
    members: members.rows as { username: string; unit: string }[],
    names: names.rows as { username: string; name: string }[],
  };
}
type Raw = Awaited<ReturnType<typeof loadRaw>>;

// ---------------------------------------------------------------------------------------------
// Mapping
// ---------------------------------------------------------------------------------------------

const decisionStatus = (v: string | undefined): SectionRunStatus | null =>
  v === "Button_4M_TPXL_PD" ? "approved" : v === "Button_4M_TPXL_YCCS" ? "update" : v === "Button_4M_TPXL_TC" ? "reject" : null;

/** Children of one multi-instance call activity start within seconds of each other and form one round. */
function rounds(children: ProcRow[]): ProcRow[][] {
  const out: ProcRow[][] = [];
  for (const c of [...children].sort((a, b) => a.start.getTime() - b.start.getTime())) {
    const last = out[out.length - 1];
    if (last && c.start.getTime() - last[0].start.getTime() < 5 * 60_000) last.push(c);
    else out.push([c]);
  }
  return out;
}

function groupBy<T>(rows: T[], key: (r: T) => string) {
  const m = new Map<string, T[]>();
  for (const r of rows) {
    const k = key(r);
    const list = m.get(k);
    if (list) list.push(r);
    else m.set(k, [r]);
  }
  return m;
}

function mapCases(raw: Raw) {
  const byParent = groupBy(raw.procs.filter((p) => p.parent), (p) => p.parent!);
  const tasksOf = groupBy(raw.tasks, (t) => t.proc);
  const varsOf = new Map<string, Record<string, string>>();
  for (const v of raw.vars) {
    const rec = varsOf.get(v.proc) ?? {};
    rec[v.name] = v.bytes ?? v.text ?? v.long ?? "";
    varsOf.set(v.proc, rec);
  }
  const varsFor = (proc: string) => varsOf.get(proc) ?? {};
  const codeOf = new Map(raw.codes.map((c) => [c.proc, c.first && c.last ? `${c.first}-${c.last}` : ""]));
  const commentsOf = groupBy(raw.comments, (c) => c.proc);
  const attachOf = groupBy(raw.attachments, (a) => a.proc);
  const actionByTask = new Map(raw.actions.filter((a) => a.task).map((a) => [a.task!.trim(), a]));
  const commentByTask = new Map<string, string>();
  for (const c of raw.comments) if (c.task && c.text?.trim()) commentByTask.set(`${c.task}|${c.by}`, c.text.trim());

  const users = new Set<string>();
  const usedCodes = new Set<string>();
  const cases: FourMCase[] = [];

  for (const root of raw.procs.filter((p) => p.key === K_ROOT)) {
    const kids = byParent.get(root.id) ?? [];
    const rel = kids.filter((k) => k.key === K_REL);
    const res = kids.filter((k) => k.key === K_RES).sort((a, b) => a.start.getTime() - b.start.getTime());
    const resLatest = res[res.length - 1];
    const rrel = res.flatMap((r) => (byParent.get(r.id) ?? []).filter((k) => k.key === K_RREL));
    const family = [root, ...rel, ...res, ...rrel];
    const procKey = new Map(family.map((p) => [p.id, p.key]));

    const rv = varsFor(root.id);
    const xv = resLatest ? varsFor(resLatest.id) : {};
    const form = parseCore(rv["CORE#DATA"]);
    const rform = parseCore(xv["CORE#DATA"]);
    const f = { ...form.fields, ...rform.fields };
    const requester = f.P4MForm_NguoiDN || rv.P4MForm_NguoiDN || rv.init || root.startUser || "";
    const section = f.P4MForm_DonVi || rv.P4MForm_DonVi || "";

    let code = codeOf.get(root.id) || `4M-${root.id}`;
    if (usedCodes.has(code)) code = `${code}~${root.id}`;
    usedCodes.add(code);

    // Related-section table: the result form (if any) carries the latest copy of the request rows.
    const srcGroups = (rform.groups.some((g) => g.ma === "P4M_PBXL_BMC") ? rform : form).groups;
    const rowGroups = srcGroups.filter((g) => g.ma === "P4M_PBXL_BMC").sort((a, b) => a.order - b.order);
    const rsGroups = srcGroups.filter((g) => g.ma === "P4M_PBXL_BMC_RS").sort((a, b) => a.order - b.order);
    const rows: RelatedRow[] = rowGroups
      .map((g) => ({
        code: g.fields.P4M_PBXL_PB ?? "",
        risk: yn(g.fields.P4M_RiskAsessmentDM),
        std: yn(g.fields.P4M_Standardization),
        initial: yn(g.fields.P4M_Initial_Control),
        cancel: yn(g.fields.P4M_Cancel),
        opinion: "",
      }))
      .filter((r) => r.code);

    const childSection = (p: ProcRow, list: FormGroup[], field: string) => {
      const v = varsFor(p.id);
      if (v[field]) return v[field];
      const idx = Number((v.dataLoopPath ?? "").split("@")[1]);
      return idx ? (list.find((g) => g.order === idx)?.fields[field] ?? list[idx - 1]?.fields[field] ?? "") : "";
    };
    const buildRuns = (round: ProcRow[], field: string, list: FormGroup[]) => {
      const runSince: Record<string, string> = {};
      const staffDone: Record<string, string[]> = {};
      const opinions: Record<string, string> = {};
      const runs: SectionRun[] = round.map((p) => {
        const sec = childSection(p, list, field) || `?${p.id}`;
        const ts = tasksOf.get(p.id) ?? [];
        const map = sectionTask[p.key];
        const open = ts.filter((t) => !t.end);
        const staffTasks = ts.filter((t) => map[t.key] === "staff");
        const staff = [...new Set(staffTasks.map((t) => t.assignee).filter((x): x is string => !!x))];
        staffDone[sec] = [...new Set(staffTasks.filter((t) => t.end && t.assignee).map((t) => t.assignee!))];
        runSince[sec] = iso(open[0]?.start ?? p.start);
        const cm = (commentsOf.get(p.id) ?? []).filter((c) => c.text?.trim());
        const note = cm.length ? cm[cm.length - 1].text!.trim() : varsFor(p.id).P4M_CBXL_ND;
        if (note) opinions[sec] = note;
        const status: SectionRunStatus = !p.end
          ? (open.map((t) => map[t.key]).find(Boolean) ?? "pending")
          : (decisionStatus(varsFor(p.id).Button_4M_TPPC) ?? "cancelled");
        return { code: sec, status, staff };
      });
      return { runs, runSince, staffDone, opinions };
    };
    const relRounds = rounds(rel);
    const rrelRounds = rounds(rrel);
    const runningRound = (rs: ProcRow[][]) => rs.find((r) => r.some((p) => !p.end));

    // Current position from the open tasks across the process family.
    const prodTasks: OpenTask[] = [];
    let step: FourMStepId | null = null;
    let stepSince = "";
    if (!root.end) {
      const openMain = [...(tasksOf.get(root.id) ?? []), ...res.flatMap((r) => tasksOf.get(r.id) ?? [])].filter((t) => !t.end);
      for (const t of openMain) {
        const s = mainStep[procKey.get(t.proc)!]?.[t.key];
        if (!s) continue;
        step = s;
        stepSince = iso(t.start);
        let due = addHours(stepSince, slaDays[s] * 24);
        if (s === "result") {
          // SLA for entering results follows the expected change date (same rule as the demo model).
          const exp = day(f.P4MForm_ExpectedDate);
          const expectedDue = exp ? addHours(`${exp}T10:00:00.000Z`, slaDays.result * 24) : "";
          if (expectedDue > stepSince) due = expectedDue;
        }
        prodTasks.push({ id: t.id, code, step: s, kind: "main", assignee: t.assignee ?? "", since: stepSince, due });
      }
      if (!step) step = runningRound(rrelRounds) ? "rrelsec" : runningRound(relRounds) ? "relsec" : null;
    }

    const resultPhase = rrelRounds.length > 0 && (step === "rrelsec" || step === null || RESULT_STEPS.includes(step));
    const phaseRounds = resultPhase ? rrelRounds : relRounds;
    const shownRound = (step === "relsec" || step === "rrelsec" ? runningRound(phaseRounds) : undefined) ?? phaseRounds[phaseRounds.length - 1] ?? [];
    const built = resultPhase ? buildRuns(shownRound, "P4M_PBXL_PB_RS", rsGroups) : buildRuns(shownRound, "P4M_PBXL_PB", rowGroups);

    if (step === "relsec" || step === "rrelsec") {
      shownRound.forEach((p, i) => {
        for (const t of (tasksOf.get(p.id) ?? []).filter((x) => !x.end)) {
          const st = sectionTask[p.key][t.key];
          if (!st) continue;
          const since = iso(t.start);
          prodTasks.push({ id: t.id, code, step: step!, kind: kindOf[st], section: built.runs[i]?.code, assignee: t.assignee ?? "", since, due: addHours(since, (st === "staff" ? STAFF_SLA_DAYS : slaDays[step!]) * 24) });
        }
      });
      stepSince = prodTasks.map((t) => t.since).sort()[0] ?? iso(shownRound[0]?.start);
    }

    const relOpinions = relRounds.length ? buildRuns(relRounds[relRounds.length - 1], "P4M_PBXL_PB", rowGroups).opinions : {};
    rows.forEach((r) => (r.opinion = (resultPhase ? built.opinions[r.code] : undefined) ?? relOpinions[r.code] ?? ""));

    let ended: EndState | null = null;
    if (root.end) {
      if (root.deleteReason) ended = "cancelled";
      else if ([rv, xv].some((v) => v.Button_4M_XL === "Button_4M_KT")) ended = "cancelled";
      else if ([rv, xv].some((v) => v.P4M_Button_PDTC === "P4M_Button_TC")) ended = "rejected";
      else ended = "completed";
    }

    // Visited steps + technical log from the task history.
    const allTasks = family
      .flatMap((p) => (tasksOf.get(p.id) ?? []).map((t) => ({ t, key: p.key })))
      .sort((a, b) => a.t.start.getTime() - b.t.start.getTime());
    const stepOf = (key: string, taskKey: string): FourMStepId | undefined => mainStep[key]?.[taskKey] ?? (key === K_REL ? "relsec" : key === K_RREL ? "rrelsec" : undefined);
    const visited: FourMStepId[] = [];
    const visit = (s: FourMStepId | undefined) => s && !visited.includes(s) && visited.push(s);
    const log: LogEntry[] = [];
    for (const { t, key } of allTasks) {
      visit(stepOf(key, t.key));
      log.push({
        at: log.length + 1,
        kind: "task",
        text: `${stamp(t.start)} ${t.name} → ${t.assignee ?? "?"}${t.end ? ` · xong ${stamp(t.end)}` : " · đang mở"}${t.deleteReason && t.deleteReason !== "completed" ? ` (${t.deleteReason})` : ""}`,
        ref: `${key} / ${t.key}`,
      });
    }
    if (root.end) log.push({ at: log.length + 1, kind: "end", text: `Kết thúc ${stamp(root.end)}${root.deleteReason ? ` – lý do xóa: ${root.deleteReason}` : ""}` });
    visit(step ?? undefined);

    // Audit trail: completed tasks, enriched with the button label (user_action) and the comment left on the task.
    const timeline: Omit<CaseEvent, "id">[] = [{ at: iso(root.start), actor: requester, kind: "create", label: "Tạo hồ sơ 4M", step: "create" }];
    for (const { t, key } of allTasks) {
      if (!t.end || (t.deleteReason && t.deleteReason !== "completed")) continue;
      const actor = t.assignee ?? "";
      const a = actionByTask.get(t.id);
      const s = stepOf(key, t.key);
      const isSubmit = !a || a.action === "btnComplete";
      timeline.push({
        at: iso(t.end),
        actor,
        kind: s === "create" || s === "result" || s === "review" ? "submit" : sectionTask[key]?.[t.key] === "staff" ? "staff" : "decision",
        step: s,
        section: key === K_REL ? varsFor(t.proc).P4M_PBXL_PB : key === K_RREL ? varsFor(t.proc).P4M_PBXL_PB_RS : undefined,
        decision: isSubmit ? undefined : a.action,
        label: a?.label ? `${t.name}: ${a.label}` : `Hoàn thành “${t.name}”`,
        comment: commentByTask.get(`${t.id}|${actor}`),
      });
    }
    for (const a of family.flatMap((p) => attachOf.get(p.id) ?? [])) {
      timeline.push({ at: iso(a.at), actor: a.by, kind: "attach", label: `Đính kèm “${a.name}”` });
    }
    if (root.end && root.deleteReason) timeline.push({ at: iso(root.end), actor: "", kind: "edit", label: `Hồ sơ bị xóa: ${root.deleteReason}` });
    const events: CaseEvent[] = timeline.sort((a, b) => a.at.localeCompare(b.at)).map((e, i) => ({ ...e, id: i + 1 }));

    const comments: Comment[] = family
      .flatMap((p) => commentsOf.get(p.id) ?? [])
      .filter((c) => c.text?.trim())
      .sort((a, b) => a.at.getTime() - b.at.getTime())
      .map((c, i) => ({ id: i + 1, at: iso(c.at), by: c.by, text: c.text!.trim(), mentions: [] }));
    const attachments: Attachment[] = family
      .flatMap((p) => attachOf.get(p.id) ?? [])
      .map((a) => ({
        id: a.size != null ? a.id : undefined,
        name: attachmentName(a),
        size: a.size == null ? "—" : a.size > 1e6 ? `${(a.size / 1e6).toFixed(1)} MB` : `${Math.max(1, Math.round(a.size / 1e3))} KB`,
        by: a.by,
        at: iso(a.at),
      }));

    const ehs: Record<string, string> = {};
    for (const g of [...rform.groups, ...form.groups].filter((x) => x.ma === "RiskAssessment_BMC")) {
      for (const [k, v] of Object.entries(g.fields)) if (!(k in ehs)) ehs[k] = v;
    }

    const lastTouch = allTasks
      .flatMap(({ t }) => [t.start, t.end])
      .concat([root.end])
      .filter((d): d is Date => !!d)
      .reduce((a, b) => (b > a ? b : a), root.start);
    [requester, ...allTasks.map(({ t }) => t.assignee ?? ""), ...comments.map((c) => c.by), ...attachments.map((a) => a.by)].forEach((u) => u && users.add(u));

    cases.push({
      code,
      version: root.version,
      requester,
      section,
      title: f.P4MForm_Title || "(chưa có tiêu đề)",
      processText: f.P4MForm_ProcessText ?? "",
      classes: parseClasses(f.P4M_class),
      situation: f.P4MForm_Situation ?? "",
      detail: f.P4MForm_Detail ?? "",
      purpose: f.P4MForm_Purpose ?? "",
      expectedDate: day(f.P4MForm_ExpectedDate),
      rows,
      ehs,
      result: { actualDate: day(f.P4M_ActualDate), haveProb: yn(f.P4MForm_HaveProb), content: f.P4MForm_Content ?? "", measure: f.P4MForm_Measure ?? "" },
      attachments,
      sim: {
        step: root.end ? null : step,
        visited,
        ended,
        requesterSection: section,
        related: rows.map((r) => r.code),
        runs: built.runs,
        round: phaseRounds.length,
        vars: {},
        log,
        seq: log.length,
      },
      stepSince: stepSince || iso(root.start),
      runSince: built.runSince,
      staffDone: built.staffDone,
      staffNotes: {},
      createdAt: iso(root.start),
      updatedAt: iso(lastTouch),
      endedAt: root.end ? iso(root.end) : undefined,
      phase2At: res[0] ? iso(res[0].start) : undefined,
      events,
      comments,
      shares: [],
      watchers: [],
      prodId: root.id,
      prodTasks,
    });
  }
  return { cases, users };
}

function buildDirectory(raw: Raw, users: Set<string>, cases: FourMCase[]) {
  const unitById = new Map(raw.units.map((u) => [u.id, u]));
  const nameOf = new Map(raw.names.map((n) => [n.username.toLowerCase(), n.name]));
  const sectionOfUser = new Map<string, string>();
  const org: ProdSnapshot["org"] = {};
  for (const u of raw.units) {
    const parent = u.parent ? unitById.get(u.parent) : undefined;
    org[u.ma] = { manager: u.manager ?? "", gm: u.gm || parent?.manager || u.manager || "", staff: [] };
    if (u.manager) users.add(u.manager);
    if (u.gm) users.add(u.gm);
  }
  for (const m of raw.members) {
    const u = unitById.get(m.unit);
    if (!u) continue;
    org[u.ma].staff.push(m.username);
    users.add(m.username);
    if (!sectionOfUser.has(m.username.toLowerCase())) sectionOfUser.set(m.username.toLowerCase(), u.ma);
  }

  // ht_nguoidung_chucvu is empty on prod (membership lives in LDAP), so infer each user's section from 4M data:
  // unit representative first, then the section on cases they requested, then sections they checked as staff.
  const activeUnits = raw.units.filter((u) => u.status === 1);
  for (const u of [...activeUnits, ...raw.units.filter((x) => x.status !== 1)])
    if (u.manager && !sectionOfUser.has(u.manager.toLowerCase())) sectionOfUser.set(u.manager.toLowerCase(), u.ma);
  const votes = new Map<string, Map<string, number>>();
  const vote = (user: string, code: string, w: number) => {
    if (!user || !code || !org[code]) return;
    const k = user.toLowerCase();
    const m = votes.get(k) ?? new Map<string, number>();
    m.set(code, (m.get(code) ?? 0) + w);
    votes.set(k, m);
  };
  for (const c of cases) {
    vote(c.requester, c.section, 3);
    for (const r of c.sim.runs) for (const s of r.staff ?? []) vote(s, r.code, 1);
    for (const t of c.prodTasks ?? []) if (t.kind === "staff" && t.section) vote(t.assignee, t.section, 1);
  }
  for (const [user, m] of votes) {
    if (sectionOfUser.has(user)) continue;
    const best = [...m.entries()].sort((a, b) => b[1] - a[1])[0];
    if (best) sectionOfUser.set(user, best[0]);
  }
  for (const id of users) {
    const sec = sectionOfUser.get(id.toLowerCase());
    if (sec && org[sec] && org[sec].manager !== id && !org[sec].staff.includes(id)) org[sec].staff.push(id);
  }

  const sections: Section[] = [...raw.units]
    .sort((a, b) => a.ma.localeCompare(b.ma))
    .map((u) => ({ code: u.ma, name: u.status === 1 ? u.ten : `${u.ten} (ngừng)`, manager: u.manager ?? "", gm: u.gm ?? "" }));
  // Legacy (2019-era) section codes referenced by old cases but no longer in ht_donvi.
  const known = new Set(sections.map((s) => s.code));
  const legacy = new Set<string>();
  for (const c of cases) for (const code of [c.section, c.sim.requesterSection, ...c.rows.map((r) => r.code)]) if (code && !known.has(code)) legacy.add(code);
  for (const code of [...legacy].sort()) {
    sections.push({ code, name: `${code} (mã cũ)`, manager: "", gm: "" });
    org[code] = { manager: "", gm: "", staff: [] };
  }

  const pretty = (id: string) =>
    id
      .split(/[._]/)
      .filter(Boolean)
      .map((w) => w[0].toUpperCase() + w.slice(1))
      .join(" ");
  const people: Person[] = [...users]
    .sort((a, b) => a.localeCompare(b))
    .map((id) => {
      const sec = sectionOfUser.get(id.toLowerCase()) ?? "";
      const unit = raw.units.find((u) => u.ma === sec);
      const role = raw.units.some((u) => u.manager === id) ? "Người đại diện" : raw.units.some((u) => u.gm === id) ? "Lãnh đạo" : "Nhân viên";
      return { id, name: nameOf.get(id.toLowerCase()) ?? pretty(id), email: "", section: sec, title: unit ? `${role} ${unit.ten}` : role, groups: sec.startsWith("322") ? ["322A"] : undefined };
    });
  return { people, org, sections };
}

// ---------------------------------------------------------------------------------------------
// Cached snapshot
// ---------------------------------------------------------------------------------------------

let cache: { at: number; snap: ProdSnapshot } | null = null;
let inflight: Promise<ProdSnapshot> | null = null;

export async function getProdSnapshot(refresh = false): Promise<ProdSnapshot> {
  const ttl = Number(process.env.IW_PROD_CACHE_SECONDS ?? 300) * 1000;
  if (!refresh && cache && Date.now() - cache.at < ttl) return cache.snap;
  if (inflight) return inflight;
  inflight = (async () => {
    const raw = await loadRaw();
    const { cases, users } = mapCases(raw);
    const dir = buildDirectory(raw, users, cases);
    cases.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const now = new Date().toISOString();
    const snap: ProdSnapshot = { source: "iw_prod", loadedAt: now, now, defaultMe: process.env.IW_DEFAULT_USER ?? "hung.phungquang", cases, ...dir };
    cache = { at: Date.now(), snap };
    attachmentIds = null;
    return snap;
  })().finally(() => {
    inflight = null;
  });
  return inflight;
}

// ---------------------------------------------------------------------------------------------
// Attachment content (only files that belong to a case in the snapshot can be read)
// ---------------------------------------------------------------------------------------------

let attachmentIds: Set<string> | null = null;

export async function getProdAttachment(id: string): Promise<{ name: string; bytes: Buffer } | null> {
  const snap = await getProdSnapshot();
  attachmentIds ??= new Set(snap.cases.flatMap((c) => c.attachments.flatMap((a) => (a.id ? [a.id] : []))));
  if (!attachmentIds.has(id)) return null;
  const r = await getPool().query(
    `select a.name_ as name, a.type_ as type, b.bytes_ as bytes
       from act_hi_attachment a join act_ge_bytearray b on b.id_ = a.content_id_ where a.id_ = $1`,
    [id],
  );
  const row = r.rows[0] as { name: string; type: string | null; bytes: Buffer } | undefined;
  return row ? { name: attachmentName(row), bytes: row.bytes } : null;
}
