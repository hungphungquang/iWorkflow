import { getPool, parseCore } from "./prod-4m";
import {
  UNIFORM_DUE_DAYS, UNIFORM_GA_GROUP, UNIFORM_GA_MANAGER, UNIFORM_ITEMS, UNIFORM_PROCESS_KEY, UNIFORM_REJECT_ACTIVITY, UNIFORM_TASKS, UNIFORM_TYPE_CODES,
  uniformDecision, uniformExpectedAssignee, uniformItemsFrom, uniformTaskStatus,
  type UniformPerson, type UniformRequest, type UniformSnapshot, type UniformStage,
} from "../uniform-request";

type ProcessRow = { id: string; start: Date; end: Date | null; reason: string | null; requester: string | null; rejected: boolean };
type TaskRow = { id: string; proc: string; key: string; actor: string | null; start: Date; end: Date | null; due: Date | null; reason: string | null };
type VariableRow = { proc: string; name: string; text: string | null; bytes: Buffer | null };

const SCOPE = `d.key_ = $1 and (p.start_time_ >= now() - interval '12 months' or p.end_time_ is null)`;
const DATE_FIELDS = ["Uniform_Date", "Uniform_ReceiverDate"];
const VARIABLES = [
  "CORE#DATA", "init", "Uniform_Request", "P4MForm_Title", "Uniform_Section", "Uniform_Requester", "Uniform_Sup", "Uniform_Reason",
  "Uniform_GA_Confirm", "Uniform_Receiver", "Uniform_Section_DAI_DIEN", ...DATE_FIELDS.map((name) => `${name}_ISO8601`),
  ...UNIFORM_ITEMS.flatMap((item) => [...item.returned, ...item.issued]),
];

/** longString values are stored as a Java-serialised String (0xACED 0005, then TC_STRING/TC_LONGSTRING + length). */
function javaString(bytes: Buffer) {
  if (bytes[0] === 0xac && bytes[1] === 0xed) {
    if (bytes[4] === 0x74) return bytes.subarray(7).toString("utf8");
    if (bytes[4] === 0x7c) return bytes.subarray(13).toString("utf8");
  }
  return bytes.toString("utf8");
}

const attachmentName = (file: { name: string; type: string | null }) =>
  file.type && !file.name.toLowerCase().endsWith(`.${file.type.toLowerCase()}`) ? `${file.name}.${file.type}` : file.name;

function readFields(rows: VariableRow[]) {
  const vars: Record<string, string> = {};
  let core = "";
  for (const row of rows) {
    const value = row.bytes ? javaString(row.bytes) : row.text ?? "";
    if (row.name === "CORE#DATA") core = value;
    else if (value !== "") vars[row.name] = value;
  }
  const fields: Record<string, string> = { ...parseCore(core).fields, ...vars };
  for (const name of DATE_FIELDS) fields[name] = (vars[`${name}_ISO8601`] || fields[name] || "").slice(0, 10);
  return fields;
}

export async function getUniformRequestSnapshot(): Promise<UniformSnapshot> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    const loadedAt = new Date().toISOString();
    const procs = (await client.query<ProcessRow>(
      `select p.id_ as id, p.start_time_ as start, p.end_time_ as "end", nullif(trim(p.delete_reason_), '') as reason,
              p.start_user_id_ as requester,
              exists (select 1 from act_hi_actinst a where a.proc_inst_id_ = p.id_ and a.act_id_ = $2) as rejected
         from act_hi_procinst p join act_re_procdef d on d.id_ = p.proc_def_id_
        where ${SCOPE} order by p.start_time_ desc`, [UNIFORM_PROCESS_KEY, UNIFORM_REJECT_ACTIVITY],
    )).rows;
    const ids = procs.map((proc) => proc.id);
    const tasks = (await client.query<TaskRow>(
      `select id_ as id, proc_inst_id_ as proc, task_def_key_ as key, assignee_ as actor,
              start_time_ as start, end_time_ as "end", due_date_ as due, delete_reason_ as reason
         from act_hi_taskinst where proc_inst_id_ = any($1::text[]) order by start_time_, id_`, [ids],
    )).rows;
    const actions = (await client.query<{ task: string; actor: string; action: string }>(
      `select distinct on (ua.task_id) ua.task_id as task, ua.user_name as actor, ua.action
         from user_action ua join unnest($1::text[]) as scope(id) on scope.id = ua.procinst_id
        where ua.task_id is not null order by ua.task_id, ua.action_date desc`, [ids],
    )).rows;
    const comments = (await client.query<{ task: string; text: string }>(
      `select task_id_ as task, string_agg(message_, E'\\n' order by time_) as text
         from act_hi_comment where proc_inst_id_ = any($1::text[]) and type_ = 'comment' and task_id_ is not null and message_ <> ''
        group by task_id_`, [ids],
    )).rows;
    const variables = (await client.query<VariableRow>(
      `select v.proc_inst_id_ as proc, v.name_ as name, coalesce(v.text_, v.long_::text) as text,
              case when v.var_type_ = 'longString' then b.bytes_ end as bytes
         from act_hi_varinst v left join act_ge_bytearray b on b.id_ = v.bytearray_id_ and v.var_type_ = 'longString'
        where v.proc_inst_id_ = any($1::text[]) and v.execution_id_ = v.proc_inst_id_ and v.name_ = any($2::text[])`, [ids, VARIABLES],
    )).rows;
    const codes = (await client.query<{ proc: string; first: string | null; last: string | null }>(
      `select distinct on (proc_inst_id) proc_inst_id as proc, code_first as first, code_last as last
         from procinst_info where proc_inst_id = any($1::text[]) order by proc_inst_id, id desc`, [ids],
    )).rows;
    const sections = (await client.query<{ code: string; name: string }>(
      `select distinct on (upper(trim(ma))) upper(trim(ma)) as code, trim(ten) as name from ht_donvi
        where ma is not null and trim(ma) <> '' and ten is not null and trim(ten) <> '' order by upper(trim(ma)), id desc`,
    )).rows;
    const names = (await client.query<{ id: string; name: string }>(
      `select distinct on (user_name) user_name as id, full_name as name from user_action
        where full_name is not null and full_name <> '' order by user_name, action_date desc`,
    )).rows;
    const files = (await client.query<{ proc: string; id: string; name: string; type: string | null }>(
      `select proc_inst_id_ as proc, id_ as id, name_ as name, type_ as type
         from act_hi_attachment where proc_inst_id_ = any($1::text[]) and content_id_ is not null order by time_`, [ids],
    )).rows;
    await client.query("COMMIT");

    const group = <T extends { proc: string }>(rows: T[]) => {
      const map = new Map<string, T[]>();
      for (const row of rows) map.set(row.proc, [...(map.get(row.proc) ?? []), row]);
      return map;
    };
    const varsByProc = group(variables);
    const tasksByProc = group(tasks);
    const filesByProc = group(files);
    const actionByTask = new Map(actions.map((action) => [action.task, action]));
    const commentByTask = new Map(comments.map((comment) => [comment.task, comment.text.trim()]));
    const codeMap = new Map(codes.map((code) => [code.proc, code]));
    const sectionNames = new Map(sections.map((section) => [section.code, section.name]));
    const roles = new Map<string, UniformPerson["role"]>([[UNIFORM_GA_MANAGER, "gaManager"]]);
    const used = new Set<string>([UNIFORM_GA_MANAGER]);
    const assign = (id: string, role: NonNullable<UniformPerson["role"]>) => {
      if (!id || id === UNIFORM_GA_GROUP) return;
      used.add(id);
      if (!roles.has(id) || roles.get(id) === "requester") roles.set(id, role);
    };

    const requests = procs.map((proc): UniformRequest => {
      const fields = readFields(varsByProc.get(proc.id) ?? []);
      const procTasks = tasksByProc.get(proc.id) ?? [];
      const active = procTasks.findLast((task) => !task.end);
      const requester = fields.init || proc.requester || fields.Uniform_Requester || "";
      const lastActor = (stage: UniformStage) => procTasks.findLast((task) => UNIFORM_TASKS[task.key] === stage && task.actor)?.actor || "";
      const supervisor = fields.Uniform_Sup || lastActor("supervisor");
      const manager = fields.Uniform_Section_DAI_DIEN || lastActor("manager");
      const stage: UniformStage = proc.end ? (proc.rejected ? "rejected" : proc.reason ? "cancelled" : "completed") : active ? UNIFORM_TASKS[active.key] ?? "unknown" : "unknown";
      const code = codeMap.get(proc.id);
      const section = (fields.Uniform_Section || "").trim().toUpperCase();
      const sectionName = sectionNames.get(section) || "";
      const department = /^([A-Za-z0-9]+)-\d{4}$/.exec(code?.first?.trim() ?? "")?.[1]?.toUpperCase() || sectionName || "—";
      const history = procTasks.map((task, index) => {
        const taskStage = UNIFORM_TASKS[task.key] ?? "unknown";
        const action = actionByTask.get(task.id);
        const status = uniformTaskStatus(!!task.end, task.reason);
        const next = procTasks[index + 1];
        const following: UniformStage | undefined = next ? UNIFORM_TASKS[next.key] ?? "unknown" : proc.end && proc.rejected ? "rejected" : undefined;
        return {
          at: (task.end || task.start).toISOString(), actor: task.actor || action?.actor || (taskStage === "gaStaff" && !task.end ? UNIFORM_GA_GROUP : ""), stage: taskStage,
          decision: status === "completed" ? uniformDecision(action?.action, taskStage, following) : "" as const, status,
          comment: commentByTask.get(task.id) || (status === "stopped" ? task.reason?.trim() || "" : ""),
        };
      });
      const lastActivity = Math.max(proc.start.getTime(), ...procTasks.map((task) => (task.end || task.start).getTime()));
      const assignee = active ? active.actor || uniformExpectedAssignee({ requester, supervisor, manager }, stage) : "";
      const dueAt = active ? (active.due || new Date(active.start.getTime() + UNIFORM_DUE_DAYS * 86400000)).toISOString() : "";
      if (requester) { used.add(requester); if (!roles.has(requester)) roles.set(requester, "requester"); }
      assign(supervisor, "supervisor");
      assign(manager, "manager");
      for (const task of procTasks) if (task.actor && UNIFORM_TASKS[task.key] === "gaStaff") assign(task.actor, "gaStaff");
      history.forEach((event) => { if (event.actor && event.actor !== UNIFORM_GA_GROUP) used.add(event.actor); });
      return {
        id: proc.id, code: code?.first && code.last ? `${code.first}-${code.last}` : code?.last || code?.first || proc.id, department,
        section, sectionName, type: UNIFORM_TYPE_CODES[fields.Uniform_Request || ""] ?? "", title: fields.P4MForm_Title || "",
        requestDate: fields.Uniform_Date, reason: fields.Uniform_Reason || "", items: uniformItemsFrom(fields),
        gaConfirm: fields.Uniform_GA_Confirm || "", receiver: fields.Uniform_Receiver || "", receivedDate: fields.Uniform_ReceiverDate,
        requester, supervisor, manager, stage, assignee, startedAt: proc.start.toISOString(), dueAt, endedAt: proc.end?.toISOString() || "",
        endReason: stage === "cancelled" ? proc.reason || "" : "", lastActivityAt: new Date(lastActivity).toISOString(), history,
        attachments: (filesByProc.get(proc.id) ?? []).map((file) => ({
          id: file.id, name: attachmentName(file), url: `/api/uniform-request/attachments/${encodeURIComponent(file.id)}/${encodeURIComponent(attachmentName(file))}`,
        })),
      };
    });
    const nameMap = new Map(names.map((person) => [person.id, person.name]));
    const people = [...used].map((id) => ({ id, name: nameMap.get(id) || id, role: roles.get(id) }));
    return { source: "iw_prod", loadedAt, requests, people };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function getUniformRequestAttachment(id: string) {
  const result = await getPool().query<{ name: string; type: string | null; bytes: Buffer }>(
    `select a.name_ as name, a.type_ as type, b.bytes_ as bytes
       from act_hi_attachment a join act_ge_bytearray b on b.id_ = a.content_id_
      where a.id_ = $2 and exists (
        select 1 from act_hi_procinst p join act_re_procdef d on d.id_ = p.proc_def_id_ where p.id_ = a.proc_inst_id_ and ${SCOPE}
      )`, [UNIFORM_PROCESS_KEY, id],
  );
  const row = result.rows[0];
  return row ? { bytes: row.bytes, name: attachmentName(row) } : null;
}
