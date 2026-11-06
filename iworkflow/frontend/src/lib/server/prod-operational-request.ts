import { getPool, parseCore } from "./prod-4m";
import {
  emptyOrfResult, ORF_DUE_DAYS, ORF_PIC_3312, ORF_PROCESS_KEY, ORF_REJECT_ACTIVITY, ORF_SNAPSHOT_BARCODES, ORF_TASKS, ORF_YUSEN_WH,
  orfDecision, orfExpectedAssignee, orfTaskStatus, splitBarcodes,
  type OperationalRequest, type OrfOpenStage, type OrfPerson, type OrfSnapshot, type OrfStage,
} from "../operational-request";

type ProcessRow = { id: string; start: Date; end: Date | null; reason: string | null; requester: string | null; rejected: boolean };
type TaskRow = { id: string; proc: string; key: string; actor: string | null; start: Date; end: Date | null; due: Date | null; reason: string | null };
type VariableRow = { proc: string; name: string; text: string | null; bytes: Buffer | null };

const SCOPE = `d.key_ = $1 and (p.start_time_ >= now() - interval '12 months' or p.end_time_ is null)`;
const DATE_FIELDS = ["ORF_FromDate", "ORF_ToDate", "ORF_DesiredFromDate", "ORF_DesiredToDate", "ORF_Handle_Plan", "ORF_NGDay", "ORF_TimeReturnWH"];
const VARIABLES = [
  "CORE#DATA", "init", "ORF_Approver", "P4MForm_Title", "ORF_Code", "ORF_Qty", "ORF_Barcode", "ORF_Reason", "ORF_Fromshift", "ORF_Toshift",
  "ORF_DesiredFromShift", "ORF_DesiredToShift", "ZENSTD_Page", "ORF_WH_Confirm", "ORF_ResultTotal", "ORF_ResultOK", "ORF_ResultNG",
  "ORF_ResultReason", "ORF_NGHand", "ORF_OKHand", "ORF_ChangePlace", ...DATE_FIELDS.map((name) => `${name}_ISO8601`),
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

export async function getOperationalRequestSnapshot(): Promise<OrfSnapshot> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    const loadedAt = new Date().toISOString();
    const procs = (await client.query<ProcessRow>(
      `select p.id_ as id, p.start_time_ as start, p.end_time_ as "end", nullif(trim(p.delete_reason_), '') as reason,
              p.start_user_id_ as requester,
              exists (select 1 from act_hi_actinst a where a.proc_inst_id_ = p.id_ and a.act_id_ = $2) as rejected
         from act_hi_procinst p join act_re_procdef d on d.id_ = p.proc_def_id_
        where ${SCOPE} order by p.start_time_ desc`, [ORF_PROCESS_KEY, ORF_REJECT_ACTIVITY],
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
    const roles = new Map<string, OrfPerson["role"]>([[ORF_PIC_3312, "pic3312"], [ORF_YUSEN_WH, "warehouse"]]);
    const used = new Set<string>([ORF_PIC_3312, ORF_YUSEN_WH]);

    const requests = procs.map((proc): OperationalRequest => {
      const fields = readFields(varsByProc.get(proc.id) ?? []);
      const procTasks = tasksByProc.get(proc.id) ?? [];
      const active = procTasks.findLast((task) => !task.end);
      const requester = fields.init || proc.requester || "";
      const approver = fields.ORF_Approver || procTasks.findLast((task) => task.key === "QAMangerApprove")?.actor || "";
      const stage: OrfStage = proc.end ? (proc.rejected ? "rejected" : proc.reason ? "cancelled" : "completed") : active ? ORF_TASKS[active.key] ?? "unknown" : "unknown";
      const code = codeMap.get(proc.id);
      const department = /^([A-Za-z0-9]+)-\d{4}$/.exec(code?.first?.trim() ?? "")?.[1]?.toUpperCase() || "—";
      const barcodes = splitBarcodes(fields.ORF_Barcode || "");
      const history = procTasks.map((task) => {
        const taskStage = ORF_TASKS[task.key] ?? "unknown";
        const action = actionByTask.get(task.id);
        const status = orfTaskStatus(!!task.end, task.reason);
        return {
          at: (task.end || task.start).toISOString(), actor: task.actor || action?.actor || "", stage: taskStage,
          decision: status === "completed" ? orfDecision(action?.action, taskStage) : "" as const, status, comment: commentByTask.get(task.id) || (status === "stopped" ? task.reason?.trim() || "" : ""),
        };
      });
      const lastActivity = Math.max(proc.start.getTime(), ...procTasks.map((task) => (task.end || task.start).getTime()));
      const assignee = active ? active.actor || orfExpectedAssignee({ requester, approver }, stage) : "";
      const dueAt = active ? (active.due || new Date(active.start.getTime() + (ORF_DUE_DAYS[stage as OrfOpenStage] ?? 2) * 86400000)).toISOString() : "";
      if (requester) { used.add(requester); if (!roles.has(requester)) roles.set(requester, "requester"); }
      if (approver) { used.add(approver); roles.set(approver, roles.get(approver) === "pic3312" || roles.get(approver) === "warehouse" ? roles.get(approver) : "approver"); }
      history.forEach((event) => { if (event.actor) used.add(event.actor); });
      return {
        id: proc.id, code: code?.first && code.last ? `${code.first}-${code.last}` : code?.last || code?.first || proc.id, department,
        title: fields.P4MForm_Title || "", productCode: fields.ORF_Code || "", quantity: fields.ORF_Qty || "",
        barcodes: barcodes.slice(0, ORF_SNAPSHOT_BARCODES), barcodeCount: barcodes.length, reason: fields.ORF_Reason || "",
        lotFrom: { shift: fields.ORF_Fromshift || "", date: fields.ORF_FromDate }, lotTo: { shift: fields.ORF_Toshift || "", date: fields.ORF_ToDate },
        desiredFrom: { shift: fields.ORF_DesiredFromShift || "", date: fields.ORF_DesiredFromDate }, desiredTo: { shift: fields.ORF_DesiredToShift || "", date: fields.ORF_DesiredToDate },
        plannedDate: fields.ORF_Handle_Plan, plannedHandling: fields.ZENSTD_Page || "", warehouseConfirm: fields.ORF_WH_Confirm || "",
        result: {
          ...emptyOrfResult(), total: fields.ORF_ResultTotal || "", ok: fields.ORF_ResultOK || "", ng: fields.ORF_ResultNG || "", reason: fields.ORF_ResultReason || "",
          ngHandling: fields.ORF_NGHand === "ORF_NGReturn" ? "return" : fields.ORF_NGHand === "ORF_NGKeep" ? "keep" : "", ngDate: fields.ORF_NGDay,
          okRelease: fields.ORF_OKHand === "true" || fields.ORF_OKHand === "1", returnedAt: fields.ORF_TimeReturnWH, changePlace: fields.ORF_ChangePlace || "",
        },
        requester, approver, stage, assignee, startedAt: proc.start.toISOString(), dueAt, endedAt: proc.end?.toISOString() || "",
        endReason: stage === "cancelled" ? proc.reason || "" : "", lastActivityAt: new Date(lastActivity).toISOString(), history,
        attachments: (filesByProc.get(proc.id) ?? []).map((file) => ({
          id: file.id, name: attachmentName(file), url: `/api/operational-request/attachments/${encodeURIComponent(file.id)}/${encodeURIComponent(attachmentName(file))}`,
        })),
      };
    });
    const nameMap = new Map(names.map((person) => [person.id, person.name]));
    const fallback: Record<string, string> = { [ORF_PIC_3312]: "3312 PIC", [ORF_YUSEN_WH]: "Yusen WH" };
    const people = [...used].map((id) => ({ id, name: nameMap.get(id) || fallback[id] || id, role: roles.get(id) }));
    return { source: "iw_prod", loadedAt, requests, people };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

/** Full barcode list of one in-scope request (the snapshot only carries the first entries). */
export async function getOperationalRequestBarcodes(id: string) {
  const rows = (await getPool().query<VariableRow>(
    `select v.proc_inst_id_ as proc, v.name_ as name, v.text_ as text, case when v.var_type_ = 'longString' then b.bytes_ end as bytes
       from act_hi_varinst v left join act_ge_bytearray b on b.id_ = v.bytearray_id_ and v.var_type_ = 'longString'
      where v.proc_inst_id_ = $2 and v.execution_id_ = v.proc_inst_id_ and v.name_ = any($3::text[])
        and exists (select 1 from act_hi_procinst p join act_re_procdef d on d.id_ = p.proc_def_id_ where p.id_ = v.proc_inst_id_ and ${SCOPE})`,
    [ORF_PROCESS_KEY, id, ["CORE#DATA", "ORF_Barcode"]],
  )).rows;
  if (!rows.length) return null;
  return splitBarcodes(readFields(rows).ORF_Barcode || "");
}

export async function getOperationalRequestAttachment(id: string) {
  const result = await getPool().query<{ name: string; type: string | null; bytes: Buffer }>(
    `select a.name_ as name, a.type_ as type, b.bytes_ as bytes
       from act_hi_attachment a join act_ge_bytearray b on b.id_ = a.content_id_
      where a.id_ = $2 and exists (
        select 1 from act_hi_procinst p join act_re_procdef d on d.id_ = p.proc_def_id_ where p.id_ = a.proc_inst_id_ and ${SCOPE}
      )`, [ORF_PROCESS_KEY, id],
  );
  const row = result.rows[0];
  return row ? { bytes: row.bytes, name: attachmentName(row) } : null;
}
