import { getPool, parseCore } from "./prod-4m";
import { reviewTaskStatus, type ReviewParent, type ReviewSnapshot, type ReviewStage, type StandardReview } from "../working-standard";

type ProcessRow = { id: string; parent: string | null; start: Date; end: Date | null; reason: string | null; requester: string | null };
type TaskRow = { proc: string; key: string; actor: string | null; start: Date; end: Date | null; due: Date | null; name: string; reason: string | null };
type VariableRow = { proc: string; name: string; text: string | null; bytes: Buffer | null };
type ParentRow = { id: string; start: Date; end: Date | null; reason: string | null; lastReviewEnd: Date | null; totalReviews: number; completedReviews: number; pendingReviews: number; cancelledReviews: number };
const stageByTask: Record<string, ReviewStage> = {
  ManagerCheckRequest: "manager",
  "sid-932187C1-A095-47D1-9180-79FED9D78DFD": "staff",
  "sid-3D9A5C01-1A6D-4381-B8AF-39C8FEEB22D3": "recheck",
};

export async function getWorkingStandardSnapshot(): Promise<ReviewSnapshot> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    const loadedAt = new Date().toISOString();
    const procs = (await client.query<ProcessRow>(
      `select p.id_ as id, p.super_process_instance_id_ as parent, p.start_time_ as start,
              p.end_time_ as "end", p.delete_reason_ as reason, p.start_user_id_ as requester
         from act_hi_procinst p join act_re_procdef d on d.id_ = p.proc_def_id_
        where d.key_ = $1 and (p.start_time_ >= now() - interval '12 months' or p.end_time_ is null)
        order by p.start_time_ desc`, ["RelSecWS"],
    )).rows;
    const ids = procs.map((proc) => proc.id);
    const parents = [...new Set(procs.flatMap((proc) => proc.parent ? [proc.parent] : []))];
    const family = [...new Set([...ids, ...parents])];
    const parentRows = (await client.query<ParentRow>(
      `select p.id_ as id, p.start_time_ as start, p.end_time_ as "end", p.delete_reason_ as reason, max(c.end_time_) as "lastReviewEnd",
              count(c.id_)::int as "totalReviews",
              count(c.id_) filter (where c.end_time_ is not null and nullif(c.delete_reason_, '') is null)::int as "completedReviews",
              count(c.id_) filter (where c.end_time_ is null)::int as "pendingReviews",
              count(c.id_) filter (where c.end_time_ is not null and nullif(c.delete_reason_, '') is not null)::int as "cancelledReviews"
         from act_hi_procinst p
         left join (
           select child.id_, child.super_process_instance_id_, child.end_time_, child.delete_reason_
             from act_hi_procinst child join act_re_procdef d on d.id_ = child.proc_def_id_ where d.key_ = $2
         ) c on c.super_process_instance_id_ = p.id_
        where p.id_ = any($1::text[]) group by p.id_, p.start_time_, p.end_time_, p.delete_reason_`, [parents, "RelSecWS"],
    )).rows;
    const parentProcesses: ReviewParent[] = parentRows.map((parent) => ({
      id: parent.id, state: parent.end ? (parent.reason ? "cancelled" : "completed") : "running", endedAt: parent.end?.toISOString() || "",
      startedAt: parent.start.toISOString(), reviewsCompletedAt: parent.lastReviewEnd?.toISOString() || "",
      totalReviews: parent.totalReviews, completedReviews: parent.completedReviews,
      pendingReviews: parent.pendingReviews, cancelledReviews: parent.cancelledReviews,
    }));
    const tasks = (await client.query<TaskRow>(
      `select proc_inst_id_ as proc, task_def_key_ as key, assignee_ as actor, name_ as name,
              start_time_ as start, end_time_ as "end", due_date_ as due, delete_reason_ as reason
         from act_hi_taskinst where proc_inst_id_ = any($1::text[]) order by start_time_, id_`, [ids],
    )).rows;
    const variables = (await client.query<VariableRow>(
      `select v.proc_inst_id_ as proc, v.name_ as name, v.text_ as text,
              case when v.var_type_ = 'longString' then b.bytes_ end as bytes
         from act_hi_varinst v left join act_ge_bytearray b on b.id_ = v.bytearray_id_ and v.var_type_ = 'longString'
        where v.proc_inst_id_ = any($1::text[]) and v.execution_id_ = v.proc_inst_id_
          and v.name_ = any($2::text[])`,
      [family, ["CORE#DATA", "init", "dataLoopPath", "WS_PB", "WS_PB_Comment", "WS_Staff_Comment", "WS_Section_Staff"]],
    )).rows;
    const codes = (await client.query<{ proc: string; first: string | null; last: string | null }>(
      `select distinct on (proc_inst_id) proc_inst_id as proc, code_first as first, code_last as last
         from procinst_info where proc_inst_id = any($1::text[]) order by proc_inst_id, id desc`, [family],
    )).rows;
    const units = (await client.query<{ id: string; code: string; name: string }>("select id::text as id, ma as code, concat_ws(' · ', ma, ten) as name from ht_donvi")).rows;
    const names = (await client.query<{ id: string; name: string }>(
      `select distinct on (user_name) user_name as id, full_name as name from user_action
        where full_name is not null and full_name <> '' order by user_name, action_date desc`,
    )).rows;
    const files = (await client.query<{ proc: string; id: string; name: string; type: string | null }>(
      `select proc_inst_id_ as proc, id_ as id, name_ as name, type_ as type
         from act_hi_attachment where proc_inst_id_ = any($1::text[]) and content_id_ is not null order by time_`, [family],
    )).rows;
    const fields = new Map<string, Record<string, string>>();
    const forms = new Map<string, ReturnType<typeof parseCore>>();
    const vars = new Map<string, Record<string, string>>();
    for (const variable of variables) {
      const value = variable.bytes?.toString("utf8") ?? variable.text ?? "";
      const record = vars.get(variable.proc) ?? {};
      record[variable.name] = value;
      vars.set(variable.proc, record);
      if (variable.name === "CORE#DATA") {
        const form = parseCore(value);
        forms.set(variable.proc, form);
        fields.set(variable.proc, form.fields);
      }
    }
    const codeMap = new Map(codes.map((code) => [code.proc, code.first && code.last ? `${code.first}-${code.last}` : code.last || code.first || code.proc]));
    const unitMap = new Map(units.flatMap((unit) => [[unit.id, unit.name], [unit.code, unit.name]]));
    const tasksByProc = new Map<string, TaskRow[]>();
    for (const task of tasks) tasksByProc.set(task.proc, [...(tasksByProc.get(task.proc) ?? []), task]);
    const filesByProc = new Map<string, typeof files>();
    for (const file of files) filesByProc.set(file.proc, [...(filesByProc.get(file.proc) ?? []), file]);
    const usedPeople = new Set<string>();
    const reviews = procs.map((proc): StandardReview => {
      const procTasks = tasksByProc.get(proc.id) ?? [];
      const active = procTasks.findLast((task) => !task.end);
      const pointer = (vars.get(proc.id)?.dataLoopPath || "").split("@");
      const parentRow = forms.get(proc.parent || "")?.groups.find((group) => group.ma === pointer[0] && group.order === Number(pointer[1]));
      const local = { ...parentRow?.fields, ...fields.get(proc.id), ...vars.get(proc.id) };
      const parent = { ...fields.get(proc.parent ?? ""), ...fields.get(proc.id) };
      const manager = procTasks.find((task) => task.key === "ManagerCheckRequest")?.actor || local.init || "";
      const staff = (active && stageByTask[active.key] === "staff" ? active.actor : "") || local.WS_Section_Staff || "";
      const stage = proc.end ? (proc.reason ? "cancelled" : "completed") : (active ? stageByTask[active.key] ?? "unknown" : "unknown");
      [manager, staff, proc.requester, ...procTasks.map((task) => task.actor)].forEach((id) => { if (id) usedPeople.add(id); });
      const managerComment = local.WS_PB_Comment || "";
      const staffComment = local.WS_Staff_Comment || "";
      return {
        id: proc.id, parentId: proc.parent || proc.id, code: codeMap.get(proc.parent || proc.id) || proc.parent || proc.id,
        title: parent.P4MForm_Title || "Thẩm định tiêu chuẩn thao tác", standardNo: parent.WS_No || "", revision: parent.WS_Sosuadoi || "",
        requester: vars.get(proc.parent || "")?.init || proc.requester || "", department: unitMap.get(local.WS_PB) || local.WS_PB || "Chưa xác định phòng ban",
        manager: stage === "manager" || stage === "recheck" ? active?.actor || manager : manager, staff, stage,
        startedAt: proc.start.toISOString(), dueAt: active?.due?.toISOString() || "", endedAt: proc.end?.toISOString() || "",
        managerComment, staffComment, summary: parent.WS_Lydo || "",
        history: procTasks.map((task) => ({
          at: (task.end || task.start).toISOString(), actor: task.actor || "",
          action: task.name, status: reviewTaskStatus(!!task.end, task.reason), comment: "",
        })),
        attachments: [...(filesByProc.get(proc.parent || "") ?? []), ...(filesByProc.get(proc.id) ?? [])].map((file) => ({
          id: file.id, name: file.type && !file.name.toLowerCase().endsWith(`.${file.type.toLowerCase()}`) ? `${file.name}.${file.type}` : file.name,
          url: `/api/working-standard/attachments/${encodeURIComponent(file.id)}/${encodeURIComponent(file.name)}`,
        })),
      };
    });
    const nameMap = new Map(names.map((person) => [person.id, person.name]));
    await client.query("COMMIT");
    return { source: "iw_prod", loadedAt, reviews, people: [...usedPeople].map((id) => ({ id, name: nameMap.get(id) || id })), parents: parentProcesses };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function getWorkingStandardAttachment(id: string) {
  const result = await getPool().query<{ name: string; type: string | null; bytes: Buffer }>(
    `select a.name_ as name, a.type_ as type, b.bytes_ as bytes
       from act_hi_attachment a join act_ge_bytearray b on b.id_ = a.content_id_
      where a.id_ = $1 and exists (
        select 1 from act_hi_procinst p join act_re_procdef d on d.id_ = p.proc_def_id_
         where d.key_ = $2 and (p.id_ = a.proc_inst_id_ or p.super_process_instance_id_ = a.proc_inst_id_)
           and (p.start_time_ >= now() - interval '12 months' or p.end_time_ is null)
      )`, [id, "RelSecWS"],
  );
  const row = result.rows[0];
  if (!row) return null;
  return { bytes: row.bytes, name: row.type && !row.name.toLowerCase().endsWith(`.${row.type.toLowerCase()}`) ? `${row.name}.${row.type}` : row.name };
}