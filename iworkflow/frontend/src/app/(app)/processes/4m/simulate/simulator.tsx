"use client";

import { useReducer, useState } from "react";
import { CheckCircle2, Circle, CircleDot, Mail, RotateCcw, UserCheck } from "lucide-react";
import { Badge, Card, buttonClass, inputClass } from "@/components/ui";
import {
  TPPC, initialSim, sampleCase, sectionByCode, sections, simReducer, stepById,
  type FourMStepId, type LogEntry, type SectionRun,
} from "@/lib/fourm";

const runTone: Record<SectionRun["status"], { tone: "gray" | "blue" | "green" | "amber" | "red" | "violet"; label: string }> = {
  pending: { tone: "blue", label: "Chờ TP xử lý" },
  staff: { tone: "violet", label: "Cán bộ đang kiểm tra" },
  recheck: { tone: "blue", label: "Chờ TP duyệt lại" },
  approved: { tone: "green", label: "Đã phê duyệt" },
  update: { tone: "amber", label: "Yêu cầu chỉnh sửa" },
  reject: { tone: "red", label: "Từ chối" },
  cancelled: { tone: "gray", label: "Bị dừng" },
};

const logIcon: Record<LogEntry["kind"], string> = { task: "Giao việc", decision: "Quyết định", service: "Dịch vụ", event: "Sự kiện", end: "Kết thúc" };

const flowA: FourMStepId[] = ["create", "mgr", "gm", "relsec", "gd"];
const flowB: FourMStepId[] = ["result", "rmgr", "rgm", "rrelsec", "rgd", "review"];

function Stepper({ ids, current, visited }: { ids: FourMStepId[]; current: FourMStepId | null; visited: Set<string> }) {
  return (
    <ol className="space-y-1">
      {ids.map((id) => {
        const s = stepById(id);
        const isCurrent = current === id;
        const done = visited.has(id) && !isCurrent;
        const exception = id === "gd" || id === "rgd";
        return (
          <li key={id} className={`flex items-start gap-2 rounded px-2 py-1.5 text-xs ${isCurrent ? "bg-blue-50 ring-1 ring-blue-300" : ""}`}>
            {isCurrent ? <CircleDot className="mt-0.5 h-3.5 w-3.5 shrink-0 text-blue-600" /> : done ? <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" /> : <Circle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-300" />}
            <span className={`${isCurrent ? "font-medium text-slate-900" : "text-slate-600"} ${exception ? "italic" : ""}`}>
              {s.nameVi}
              {exception && <span className="block text-[10px] text-slate-400">chỉ khi phòng liên quan từ chối</span>}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function RelatedPanel({ runs, onAct, onStaffDone }: { runs: SectionRun[]; onAct: (code: string, value: string, staff?: string[]) => void; onStaffDone: (code: string) => void }) {
  const [staffCount, setStaffCount] = useState<Record<string, number>>({});
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-xs">
        <thead className="border-b border-slate-200 uppercase text-slate-500">
          <tr>
            <th className="px-2 py-2 font-medium">Phòng ban</th>
            <th className="px-2 py-2 font-medium">Trưởng phòng</th>
            <th className="px-2 py-2 font-medium">Trạng thái</th>
            <th className="px-2 py-2 font-medium">Thao tác (mô phỏng người xử lý)</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {runs.map((r) => {
            const sec = sectionByCode(r.code);
            const t = runTone[r.status];
            const canDecide = r.status === "pending" || r.status === "recheck";
            const n = staffCount[r.code] ?? 1;
            return (
              <tr key={r.code} className="align-top">
                <td className="px-2 py-2">
                  <span className="font-mono text-slate-500">{sec.code}</span> {sec.name}
                </td>
                <td className="px-2 py-2 text-slate-600">{sec.manager}</td>
                <td className="px-2 py-2">
                  <Badge tone={t.tone}>{t.label}</Badge>
                  {r.status === "staff" && <p className="mt-1 text-slate-500">{r.staff.join(", ")}</p>}
                </td>
                <td className="px-2 py-2">
                  {canDecide && (
                    <div className="flex flex-wrap items-center gap-1">
                      {TPPC.map((d) =>
                        d.value === "Button_4M_TPXL_PC" ? (
                          <span key={d.value} className="inline-flex items-center gap-1">
                            <select aria-label="Số cán bộ" className="rounded border border-slate-300 px-1 py-0.5" value={n} onChange={(e) => setStaffCount({ ...staffCount, [r.code]: Number(e.target.value) })}>
                              {[1, 2, 3].map((x) => (
                                <option key={x} value={x}>
                                  {x} CB
                                </option>
                              ))}
                            </select>
                            <button className="rounded border border-slate-300 px-2 py-0.5 hover:bg-slate-50" onClick={() => onAct(r.code, d.value, Array.from({ length: n }, (_, i) => `Cán bộ ${sec.code}-${i + 1}`))}>
                              {d.label}
                            </button>
                          </span>
                        ) : (
                          <button
                            key={d.value}
                            className={`rounded px-2 py-0.5 ${d.tone === "primary" ? "bg-blue-600 text-white hover:bg-blue-700" : d.tone === "danger" ? "border border-red-300 text-red-700 hover:bg-red-50" : "border border-slate-300 hover:bg-slate-50"}`}
                            onClick={() => onAct(r.code, d.value)}
                          >
                            {d.label}
                          </button>
                        ),
                      )}
                    </div>
                  )}
                  {r.status === "staff" && (
                    <button className="rounded border border-slate-300 px-2 py-0.5 hover:bg-slate-50" onClick={() => onStaffDone(r.code)}>
                      Cán bộ hoàn thành kiểm tra
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function FourMSimulator() {
  const [state, dispatch] = useReducer(simReducer, undefined, () => initialSim());
  const visited = new Set<string>(state.visited);
  const step = state.step ? stepById(state.step) : null;
  const requester = sectionByCode(state.requesterSection);
  const assignee =
    !step ? "—"
    : step.id === "create" || step.id === "result" || step.id === "review" ? `${sampleCase.requester} (người đề nghị)`
    : step.id === "mgr" || step.id === "rmgr" ? requester.manager
    : step.id === "gm" || step.id === "rgm" ? requester.gm
    : step.id === "gd" || step.id === "rgd" ? "Tổng Giám đốc"
    : `${state.runs.length} trưởng phòng song song`;
  const editingRelated = state.step === "create" || state.step === "result";

  return (
    <div className="grid gap-4 xl:grid-cols-[16rem_1fr_22rem]">
      <Card title="Tiến trình">
        <p className="mb-1 text-[11px] font-semibold uppercase text-slate-400">Giai đoạn 1 · Process4MChange</p>
        <Stepper ids={flowA} current={state.step} visited={visited} />
        <p className="mb-1 mt-3 text-[11px] font-semibold uppercase text-slate-400">Giai đoạn 2 · Process4MChangeResult</p>
        <Stepper ids={flowB} current={state.step} visited={visited} />
        <button className={`${buttonClass("ghost")} mt-4 w-full justify-center`} onClick={() => dispatch({ type: "reset" })}>
          <RotateCcw className="h-4 w-4" /> Chạy lại từ đầu
        </button>
      </Card>

      <div className="min-w-0 space-y-4">
        <Card title={`${sampleCase.code} · ${sampleCase.title}`}>
          <div className="grid gap-2 text-xs sm:grid-cols-2">
            <p>
              <span className="text-slate-500">Đơn vị đề nghị:</span> <b>{requester.code} {requester.name}</b>
            </p>
            <p>
              <span className="text-slate-500">Loại thay đổi:</span> {sampleCase.classes.map((c) => <Badge key={c} tone="blue">{c}</Badge>)}
            </p>
            <p className="sm:col-span-2">
              <span className="text-slate-500">Phòng liên quan (P4M_PBXL_BMC):</span> {state.related.map((c) => sectionByCode(c).name.split(" –")[0]).join(", ") || "—"}
            </p>
          </div>
        </Card>

        {state.ended ? (
          <Card>
            <div className="flex items-center gap-3">
              <Badge tone={state.ended === "completed" ? "green" : "red"}>{state.ended === "completed" ? "Hoàn tất" : state.ended === "rejected" ? "Bị từ chối" : "Đã hủy"}</Badge>
              <p className="text-sm text-slate-700">{state.log[0]?.text}</p>
            </div>
          </Card>
        ) : (
          step && (
            <Card title={`Bước hiện tại: ${step.nameVi}`}>
              <dl className="grid gap-x-4 gap-y-2 text-xs sm:grid-cols-2">
                <div>
                  <dt className="text-slate-500">Người xử lý</dt>
                  <dd className="flex items-center gap-1 font-medium text-slate-800">
                    <UserCheck className="h-3.5 w-3.5 text-blue-600" /> {assignee}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">Quy tắc giao việc</dt>
                  <dd className="font-mono text-[11px] text-slate-700">{step.assigneeExpr}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Biểu mẫu</dt>
                  <dd className="font-mono text-[11px] text-slate-700">{step.formKey}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">SLA</dt>
                  <dd className="text-slate-700">
                    {step.sla} {step.emailApproval && <Badge tone="violet">có link duyệt qua email</Badge>}
                  </dd>
                </div>
              </dl>

              {editingRelated && (
                <div className="mt-4 rounded-md border border-slate-200 p-3">
                  <p className="mb-2 text-xs font-medium text-slate-700">
                    Chọn phòng ban liên quan (mô phỏng bảng {state.step === "create" ? "P4M_PBXL_BMC" : "P4M_PBXL_BMC_RS"})
                  </p>
                  <div className="flex flex-wrap gap-2 text-xs">
                    {sections
                      .filter((s) => s.code !== state.requesterSection)
                      .map((s) => (
                        <label key={s.code} className="flex items-center gap-1 rounded border border-slate-200 px-2 py-1">
                          <input
                            type="checkbox"
                            checked={state.related.includes(s.code)}
                            onChange={(e) => dispatch({ type: "setRelated", codes: e.target.checked ? [...state.related, s.code] : state.related.filter((c) => c !== s.code) })}
                          />
                          {s.name.split(" –")[0]}
                        </label>
                      ))}
                  </div>
                </div>
              )}

              {(step.id === "relsec" || step.id === "rrelsec") && (
                <div className="mt-4">
                  <RelatedPanel
                    key={state.round}
                    runs={state.runs}
                    onAct={(code, value, staff) => dispatch({ type: "section", code, value, staff })}
                    onStaffDone={(code) => dispatch({ type: "staffDone", code })}
                  />
                  <p className="mt-2 text-xs text-slate-500">
                    Vòng {state.round}. Một phòng YCCS hoặc Từ chối sẽ dừng ngay các phòng còn lại (đúng ngữ nghĩa transaction của BPMN hiện tại).
                  </p>
                </div>
              )}

              <div className="mt-4 flex flex-wrap gap-2">
                {(step.id === "create" || step.id === "result") && (
                  <button className={buttonClass("primary")} disabled={state.related.length === 0} onClick={() => dispatch({ type: "submit" })}>
                    {step.id === "create" ? "Gửi yêu cầu" : "Gửi kết quả"}
                  </button>
                )}
                {step.id === "review" && (
                  <button className={buttonClass("primary")} onClick={() => dispatch({ type: "review" })}>
                    Xác nhận hoàn thành
                  </button>
                )}
                {step.decisions &&
                  step.id !== "relsec" &&
                  step.id !== "rrelsec" &&
                  step.decisions.map((d) => (
                    <button key={d.value} className={buttonClass(d.tone)} onClick={() => dispatch({ type: "decide", value: d.value })}>
                      {d.label}
                    </button>
                  ))}
              </div>
              {step.id === "result" && (
                <div className="mt-4 grid gap-3 md:grid-cols-3">
                  <label className="text-xs text-slate-600">
                    Actual applied date <input type="date" className={inputClass} defaultValue="2026-12-20" />
                  </label>
                  <label className="text-xs text-slate-600">
                    Have a problem
                    <select className={inputClass} defaultValue="N">
                      <option value="N">No</option>
                      <option value="Y">Yes</option>
                    </select>
                  </label>
                </div>
              )}
            </Card>
          )
        )}
      </div>

      <Card title="Nhật ký engine (mới nhất trước)">
        <ol className="max-h-[36rem] space-y-2 overflow-y-auto text-xs">
          {state.log.map((l) => (
            <li key={l.at} className="border-l-2 border-slate-200 pl-2">
              <p className="flex items-center gap-1 text-[10px] uppercase text-slate-400">
                {l.kind === "service" && <Mail className="h-3 w-3" />} {logIcon[l.kind]}
              </p>
              <p className="text-slate-700">{l.text}</p>
              {l.ref && <p className="truncate font-mono text-[10px] text-slate-400">{l.ref}</p>}
            </li>
          ))}
        </ol>
      </Card>
    </div>
  );
}
