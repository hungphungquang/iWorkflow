"use client";

import Link from "next/link";
import { use, useState, type ReactNode } from "react";
import { Bell, BellOff, Check, Copy, Mail, MessageSquare, Paperclip, Send, Share2, X } from "lucide-react";
import { Avatar, CaseStateBadge, DueBadge, Stepper, VersionTag } from "@/components/fourm-ui";
import { FourMRequestForm } from "@/components/fourm-request-form";
import { Badge, Card, Field, buttonClass, inputClass } from "@/components/ui";
import { classOptions, riskFields, stepById, TPPC, type Decision, type SectionRunStatus } from "@/lib/fourm";
import {
  caseState,
  currentStepLabel,
  openTasks,
  participants,
  PROCESS_NAME,
  sectionLabel,
  sectionShort,
  stepShort,
  taskKindLabel,
  type FourMCase,
  type OpenTask,
  type RelatedRow,
  type ResultData,
  type YN,
} from "@/lib/fourm-case";
import { fmtDate, fmtDateTime } from "@/lib/i18n";
import { isEhs, managerOf, people, personName, staffOf } from "@/lib/people";
import { act, useDb } from "@/lib/store";

const REQUIRE_COMMENT = new Set(["P4M_Button_YCCS", "P4M_Button_TC", "Button_4M_TPXL_YCCS", "Button_4M_TPXL_TC", "Button_4M_KT"]);
const RETURN_CODES = new Set(["P4M_Button_YCCS", "Button_4M_TPXL_YCCS"]);

const runLabel: Record<SectionRunStatus, [string, "gray" | "blue" | "amber" | "green" | "red" | "violet"]> = {
  pending: ["Chờ TP thẩm định", "blue"],
  staff: ["Cán bộ đang kiểm tra", "violet"],
  recheck: ["TP duyệt lại", "blue"],
  approved: ["Đã duyệt", "green"],
  update: ["Yêu cầu chỉnh sửa", "amber"],
  reject: ["Từ chối", "red"],
  cancelled: ["Dừng (vòng bị hủy)", "gray"],
};

const dt = (iso: string) => fmtDateTime(iso, "vi");

export function CaseDetail({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  const db = useDb();
  const c = db.cases.find((x) => x.code === decodeURIComponent(code));
  const [flash, setFlash] = useState("");
  const [sharing, setSharing] = useState(false);

  if (!c) {
    return (
      <Card>
        <p className="text-sm text-slate-600">
          Không tìm thấy hồ sơ <b>{decodeURIComponent(code)}</b>.{" "}
          <Link href="/4m/cases" className="text-blue-600 hover:underline">
            Về danh sách
          </Link>
        </p>
      </Card>
    );
  }

  const me = db.me;
  const tasks = openTasks(c);
  const mine = tasks.filter((t) => t.assignee === me);
  const others = tasks.filter((t) => t.assignee !== me);
  const watching = c.watchers.includes(me);
  const running = caseState(c) === "running";
  const done = (msg: string) => setFlash(msg);

  return (
    <>
      <Link href="/4m/cases" className="mb-3 inline-flex text-xs text-slate-500 hover:text-slate-800">
        ‹ Hồ sơ & việc 4M
      </Link>

      <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <span className="font-mono font-semibold text-slate-700">{c.code}</span>
            <span>{PROCESS_NAME}</span>
            <VersionTag v={c.version} />
            <CaseStateBadge c={c} />
            {running && <Badge tone="blue">{currentStepLabel(c)}</Badge>}
          </div>
          <h1 className="mt-1 text-xl font-semibold text-slate-900">{c.title}</h1>
          <p className="mt-1 text-xs text-slate-500">
            {personName(c.requester)} · {sectionLabel(c.section)} · tạo {dt(c.createdAt)} · cập nhật {dt(c.updatedAt)}
            {c.endedAt ? ` · kết thúc ${dt(c.endedAt)}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={buttonClass()} onClick={() => act(c.code, { type: "watch", on: !watching })}>
            {watching ? <BellOff className="h-4 w-4" /> : <Bell className="h-4 w-4" />} {watching ? "Bỏ theo dõi" : "Theo dõi"}
          </button>
          <button type="button" className={buttonClass()} onClick={() => setSharing(true)}>
            <Share2 className="h-4 w-4" /> Chia sẻ
          </button>
          <button
            type="button"
            className={buttonClass("ghost")}
            onClick={() => {
              void navigator.clipboard?.writeText(window.location.href);
              done("Đã sao chép liên kết hồ sơ");
            }}
          >
            <Copy className="h-4 w-4" /> Sao chép link
          </button>
        </div>
      </header>

      {flash && (
        <div className="mb-4 flex items-center justify-between rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800" role="status">
          <span className="flex items-center gap-1.5">
            <Check className="h-4 w-4" /> {flash}
          </span>
          <button type="button" aria-label="Đóng" onClick={() => setFlash("")}>
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-[1fr_24rem]">
        <div className="min-w-0 space-y-4">
          {mine.map((t) => (
            <TaskPanel key={t.id} c={c} t={t} now={db.now} onDone={done} />
          ))}

          <Card title="Tiến độ">
            <Stepper c={c} />
          </Card>

          <RequestInfo c={c} />
          <RelatedTable c={c} />
          <EhsBlock c={c} editable={isEhs(me) && mine.length > 0} onDone={done} />
          {c.sim.visited.includes("result") && <ResultBlock c={c} />}
        </div>

        <aside className="space-y-4">
          <Card title={running ? `Đang chờ xử lý (${tasks.length})` : "Trạng thái"}>
            {running ? (
              <>
                <ul className="space-y-2">
                  {tasks.map((t) => (
                    <li key={t.id} className="flex items-center gap-2 text-sm">
                      <Avatar id={t.assignee} />
                      <div className="min-w-0 flex-1">
                        <p className={`truncate ${t.assignee === me ? "font-semibold text-blue-700" : "text-slate-800"}`}>
                          {personName(t.assignee)}
                          {t.assignee === me ? " (bạn)" : ""}
                        </p>
                        <p className="truncate text-xs text-slate-500">
                          {stepShort[t.step]}
                          {t.section ? ` · ${sectionShort(t.section)}` : ""}
                          {taskKindLabel[t.kind] ? ` · ${taskKindLabel[t.kind]}` : ""}
                        </p>
                      </div>
                      <DueBadge due={t.due} now={db.now} />
                    </li>
                  ))}
                </ul>
                {others.length > 0 && <RemindBox c={c} onDone={done} />}
              </>
            ) : (
              <div className="text-sm text-slate-600">
                <CaseStateBadge c={c} /> <span className="ml-1">{c.endedAt ? dt(c.endedAt) : ""}</span>
              </div>
            )}
          </Card>

          <Card title="Người liên quan">
            <ul className="flex flex-wrap gap-1.5">
              {participants(c).map((p) => (
                <li key={p} className="flex items-center gap-1 rounded-full bg-slate-100 py-0.5 pl-0.5 pr-2 text-xs text-slate-700">
                  <Avatar id={p} />
                  {personName(p)}
                  {c.watchers.includes(p) && <Bell className="h-3 w-3 text-slate-400" aria-label="đang theo dõi" />}
                </li>
              ))}
            </ul>
          </Card>

          <SideTabs c={c} onShare={() => setSharing(true)} onDone={done} />

          <details className="rounded-lg border border-slate-200 bg-white p-3 text-xs">
            <summary className="cursor-pointer font-medium text-slate-600">Nhật ký kỹ thuật BPMN ({c.sim.log.length})</summary>
            <ol className="mt-2 max-h-72 space-y-1 overflow-y-auto font-mono text-[11px] text-slate-500">
              {c.sim.log.map((l) => (
                <li key={l.at}>
                  <span className="text-slate-400">#{l.at}</span> [{l.kind}] {l.text}
                  {l.ref && <span className="block truncate text-slate-400">↳ {l.ref}</span>}
                </li>
              ))}
            </ol>
          </details>
        </aside>
      </div>

      {sharing && <ShareDialog c={c} me={me} onClose={() => setSharing(false)} onDone={done} />}
    </>
  );
}

// ---------------------------------------------------------------------------------------------
// Task panels
// ---------------------------------------------------------------------------------------------

function TaskPanel({ c, t, now, onDone }: { c: FourMCase; t: OpenTask; now: string; onDone: (m: string) => void }) {
  const title = `Việc của bạn: ${stepShort[t.step]}${t.section ? ` – ${sectionShort(t.section)}` : ""}${taskKindLabel[t.kind] ? ` (${taskKindLabel[t.kind]})` : ""}`;
  let body: ReactNode = null;
  if (t.step === "create") body = <ResubmitPanel c={c} onDone={onDone} />;
  else if (t.step === "result") body = <ResultPanel c={c} onDone={onDone} />;
  else if (t.step === "review") body = <ReviewPanel c={c} onDone={onDone} />;
  else if (t.kind === "staff") body = <StaffPanel c={c} t={t} onDone={onDone} />;
  else if (t.kind === "section" || t.kind === "recheck") body = <SectionPanel c={c} t={t} onDone={onDone} />;
  else body = <DecisionPanel c={c} decisions={stepById(t.step).decisions ?? []} onDone={onDone} />;

  return (
    <section className="rounded-lg border-2 border-blue-300 bg-blue-50/40 p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-blue-900">{title}</h2>
        <span className="flex items-center gap-2 text-xs text-slate-500">
          Hạn {dt(t.due)} <DueBadge due={t.due} now={now} />
        </span>
      </div>
      <ReturnNote c={c} t={t} />
      {body}
    </section>
  );
}

function ReturnNote({ c, t }: { c: FourMCase; t: OpenTask }) {
  if (t.step !== "create" && t.step !== "result") return null;
  const last = [...c.events].reverse().find((e) => e.kind === "decision" || e.kind === "submit");
  if (!last || !last.decision || !RETURN_CODES.has(last.decision)) return null;
  return (
    <div className="mb-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
      <p className="font-medium">
        {personName(last.actor)} yêu cầu chỉnh sửa{last.section ? ` (${sectionShort(last.section)})` : ""} · {dt(last.at)}
      </p>
      {last.comment && <p className="mt-1 whitespace-pre-wrap">“{last.comment}”</p>}
    </div>
  );
}

function CommentBox({ value, onChange, required, placeholder }: { value: string; onChange: (v: string) => void; required: boolean; placeholder?: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-slate-600">
        Ý kiến {required ? <span className="text-red-500">* bắt buộc với quyết định này</span> : <span className="font-normal text-slate-400">(tùy chọn)</span>}
      </span>
      <textarea rows={3} value={value} onChange={(e) => onChange(e.target.value)} className={inputClass} placeholder={placeholder} />
    </label>
  );
}

const toneButton: Record<Decision["tone"], "primary" | "secondary" | "danger"> = { primary: "primary", secondary: "secondary", danger: "danger" };

function DecisionButtons({ decisions, onPick }: { decisions: Decision[]; onPick: (d: Decision) => void }) {
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {decisions.map((d) => (
        <button key={d.value} type="button" className={buttonClass(toneButton[d.tone])} onClick={() => onPick(d)}>
          {d.label}
        </button>
      ))}
    </div>
  );
}

function DecisionPanel({ c, decisions, onDone }: { c: FourMCase; decisions: Decision[]; onDone: (m: string) => void }) {
  const [comment, setComment] = useState("");
  const [error, setError] = useState("");
  const [picked, setPicked] = useState("");
  return (
    <>
      <CommentBox value={comment} onChange={setComment} required={REQUIRE_COMMENT.has(picked)} placeholder="Nhập ý kiến; bắt buộc khi yêu cầu chỉnh sửa, từ chối hoặc kết thúc" />
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
      <DecisionButtons
        decisions={decisions}
        onPick={(d) => {
          setPicked(d.value);
          if (REQUIRE_COMMENT.has(d.value) && !comment.trim()) return setError(`Cần nhập ý kiến khi chọn “${d.label}”.`);
          act(c.code, { type: "decide", value: d.value, comment: comment.trim() });
          onDone(`Đã ghi nhận: ${d.label}`);
        }}
      />
    </>
  );
}

const YN_KEYS = [
  ["risk", "Risk Assessment"],
  ["std", "Standardization"],
  ["initial", "Initial control"],
  ["cancel", "Cancel 4M"],
] as const;

function YNSelect({ value, onChange, label, disabled }: { value: YN; onChange: (v: YN) => void; label: string; disabled?: boolean }) {
  return (
    <div>
      <span className="mb-1 block text-xs font-medium text-slate-600">{label}</span>
      <div className="inline-flex overflow-hidden rounded-md border border-slate-300 text-xs">
        {(["Y", "N"] as const).map((v) => (
          <button
            key={v}
            type="button"
            disabled={disabled}
            aria-pressed={value === v}
            className={`px-3 py-1 ${value === v ? (v === "Y" ? "bg-blue-600 text-white" : "bg-slate-600 text-white") : "bg-white text-slate-600 hover:bg-slate-50"} disabled:opacity-60`}
            onClick={() => onChange(value === v ? "" : v)}
          >
            {v}
          </button>
        ))}
      </div>
    </div>
  );
}

function SectionPanel({ c, t, onDone }: { c: FourMCase; t: OpenTask; onDone: (m: string) => void }) {
  const code = t.section!;
  const row = c.rows.find((r) => r.code === code);
  const [yn, setYn] = useState<Pick<RelatedRow, "risk" | "std" | "initial" | "cancel">>({ risk: row?.risk ?? "", std: row?.std ?? "", initial: row?.initial ?? "", cancel: row?.cancel ?? "" });
  const [staff, setStaff] = useState<string[]>([]);
  const [comment, setComment] = useState("");
  const [picked, setPicked] = useState("");
  const [error, setError] = useState("");
  const recheck = t.kind === "recheck";
  const firstPhase = t.step === "relsec";
  const decisions = TPPC.filter((d) => !(recheck && d.value === "Button_4M_TPXL_PC"));
  const staffNotes = (c.sim.runs.find((r) => r.code === code)?.staff ?? []).map((p) => [p, c.staffNotes[`${code}:${p}`]] as const);

  return (
    <>
      {recheck && staffNotes.length > 0 && (
        <div className="mb-3 rounded-md border border-slate-200 bg-white p-3 text-sm">
          <p className="mb-1 text-xs font-semibold text-slate-500">Kết quả kiểm tra của cán bộ</p>
          {staffNotes.map(([p, note]) => (
            <p key={p}>
              <b>{personName(p)}:</b> {note || <i className="text-slate-400">không ghi chú</i>}
            </p>
          ))}
        </div>
      )}
      {firstPhase && (
        <div className="mb-3 flex flex-wrap gap-4">
          {YN_KEYS.map(([k, label]) => (
            <YNSelect key={k} label={label} value={yn[k]} onChange={(v) => setYn({ ...yn, [k]: v })} />
          ))}
        </div>
      )}
      {!recheck && (
        <fieldset className="mb-3">
          <legend className="mb-1 text-xs font-medium text-slate-600">Cán bộ kiểm tra (khi chọn Phân công cán bộ – có thể chọn nhiều, xử lý song song)</legend>
          <div className="flex flex-wrap gap-2">
            {staffOf(code).map((p) => (
              <label key={p} className={`flex cursor-pointer items-center gap-1.5 rounded-md border px-2 py-1 text-xs ${staff.includes(p) ? "border-violet-400 bg-violet-50 text-violet-800" : "border-slate-300 bg-white text-slate-700"}`}>
                <input type="checkbox" checked={staff.includes(p)} onChange={(e) => setStaff(e.target.checked ? [...staff, p] : staff.filter((x) => x !== p))} />
                {personName(p)}
              </label>
            ))}
            {staffOf(code).length === 0 && <span className="text-xs text-slate-400">Phòng chưa khai báo cán bộ</span>}
          </div>
        </fieldset>
      )}
      <CommentBox value={comment} onChange={setComment} required={REQUIRE_COMMENT.has(picked)} placeholder="Ý kiến thẩm định của phòng" />
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
      <DecisionButtons
        decisions={decisions}
        onPick={(d) => {
          setPicked(d.value);
          if (REQUIRE_COMMENT.has(d.value) && !comment.trim()) return setError(`Cần nhập ý kiến khi chọn “${d.label}”.`);
          if (d.value === "Button_4M_TPXL_PC" && staff.length === 0) return setError("Chọn ít nhất 1 cán bộ để phân công.");
          if (firstPhase && d.value === "Button_4M_TPXL_PD" && Object.values(yn).some((v) => !v)) return setError("Điền đủ 4 cột Y/N trước khi phê duyệt.");
          act(c.code, { type: "section", code, value: d.value, comment: comment.trim(), yn: firstPhase ? yn : undefined, staff: d.value === "Button_4M_TPXL_PC" ? staff : undefined });
          onDone(`${sectionShort(code)}: ${d.label}${d.value === "Button_4M_TPXL_PC" ? ` → ${staff.map(personName).join(", ")}` : ""}`);
        }}
      />
    </>
  );
}

function StaffPanel({ c, t, onDone }: { c: FourMCase; t: OpenTask; onDone: (m: string) => void }) {
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const assigner = [...c.events].reverse().find((e) => e.section === t.section && e.decision === "Button_4M_TPXL_PC");
  return (
    <>
      {assigner && (
        <p className="mb-3 text-sm text-slate-600">
          {personName(assigner.actor)} phân công lúc {dt(assigner.at)}
          {assigner.comment ? `: “${assigner.comment}”` : ""}
        </p>
      )}
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-slate-600">
          Kết quả kiểm tra <span className="text-red-500">*</span>
        </span>
        <textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} className={inputClass} placeholder="Nội dung đã kiểm tra, rủi ro, đề xuất cho trưởng phòng" />
      </label>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
      <button
        type="button"
        className={`${buttonClass("primary")} mt-3`}
        onClick={() => {
          if (!note.trim()) return setError("Nhập kết quả kiểm tra.");
          act(c.code, { type: "staffDone", code: t.section!, note: note.trim() });
          onDone("Đã gửi kết quả kiểm tra cho trưởng phòng");
        }}
      >
        <Send className="h-4 w-4" /> Hoàn thành kiểm tra
      </button>
    </>
  );
}

function ResubmitPanel({ c, onDone }: { c: FourMCase; onDone: (m: string) => void }) {
  const [editing, setEditing] = useState(false);
  if (!editing) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className={buttonClass("primary")} onClick={() => setEditing(true)}>
          Chỉnh sửa & gửi lại
        </button>
        <span className="text-xs text-slate-500">Hồ sơ giữ nguyên mã, lịch sử và người theo dõi khi gửi lại.</span>
      </div>
    );
  }
  return (
    <FourMRequestForm
      initial={{ title: c.title, processText: c.processText, classes: c.classes, situation: c.situation, detail: c.detail, purpose: c.purpose, expectedDate: c.expectedDate, rows: c.rows }}
      section={c.section}
      requesterName={personName(c.requester)}
      submitLabel="Gửi lại"
      withComment
      onCancel={() => setEditing(false)}
      onSubmit={(data, files, comment) => {
        files.forEach((f) => act(c.code, { type: "attach", name: f, size: "—" }));
        act(c.code, { type: "resubmit", data, comment: comment || undefined });
        onDone("Đã gửi lại yêu cầu");
      }}
    />
  );
}

function ResultPanel({ c, onDone }: { c: FourMCase; onDone: (m: string) => void }) {
  const [r, setR] = useState<ResultData>(c.result);
  const [comment, setComment] = useState("");
  const [error, setError] = useState("");
  return (
    <>
      <p className="mb-3 text-xs text-slate-500">Ngày thay đổi dự kiến: {fmtDate(`${c.expectedDate}T03:00:00Z`, "vi")} – nhập kết quả sau khi áp dụng thực tế.</p>
      <div className="grid gap-3 md:grid-cols-4">
        <Field label="Actual applied date" span={2} required>
          <input type="date" value={r.actualDate} onChange={(e) => setR({ ...r, actualDate: e.target.value })} className={inputClass} />
        </Field>
        <div className="md:col-span-2">
          <YNSelect label="Have a problem *" value={r.haveProb} onChange={(v) => setR({ ...r, haveProb: v })} />
        </div>
        {r.haveProb === "Y" && (
          <>
            <Field label="Problem content" span={4} required>
              <input value={r.content} onChange={(e) => setR({ ...r, content: e.target.value })} className={inputClass} />
            </Field>
            <Field label="Measure" span={4} required>
              <textarea rows={3} value={r.measure} onChange={(e) => setR({ ...r, measure: e.target.value })} className={inputClass} />
            </Field>
          </>
        )}
        <div className="md:col-span-4">
          <CommentBox value={comment} onChange={setComment} required={false} />
        </div>
      </div>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
      <button
        type="button"
        className={`${buttonClass("primary")} mt-3`}
        onClick={() => {
          const miss = [!r.actualDate && "Actual applied date", !r.haveProb && "Have a problem", r.haveProb === "Y" && !r.content.trim() && "Problem content", r.haveProb === "Y" && !r.measure.trim() && "Measure"].filter(Boolean);
          if (miss.length) return setError(`Cần nhập: ${miss.join(", ")}`);
          act(c.code, { type: "result", result: r.haveProb === "Y" ? r : { ...r, content: "", measure: "" }, comment: comment.trim() || undefined });
          onDone("Đã gửi kết quả thực hiện thay đổi");
        }}
      >
        <Send className="h-4 w-4" /> Gửi kết quả
      </button>
    </>
  );
}

function ReviewPanel({ c, onDone }: { c: FourMCase; onDone: (m: string) => void }) {
  const [comment, setComment] = useState("");
  return (
    <>
      <p className="mb-3 text-sm text-slate-600">Tất cả phòng liên quan đã xác nhận kết quả. Xác nhận để đóng hồ sơ.</p>
      <CommentBox value={comment} onChange={setComment} required={false} />
      <button
        type="button"
        className={`${buttonClass("primary")} mt-3`}
        onClick={() => {
          act(c.code, { type: "review", comment: comment.trim() || undefined });
          onDone("Hồ sơ đã hoàn tất");
        }}
      >
        <Check className="h-4 w-4" /> Xác nhận hoàn thành
      </button>
    </>
  );
}

function RemindBox({ c, onDone }: { c: FourMCase; onDone: (m: string) => void }) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  if (!open) {
    return (
      <button type="button" className={`${buttonClass("ghost")} mt-3 w-full justify-center`} onClick={() => setOpen(true)}>
        <Bell className="h-4 w-4" /> Nhắc việc người đang giữ
      </button>
    );
  }
  return (
    <div className="mt-3 space-y-2">
      <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} className={inputClass} placeholder="Lời nhắn (tùy chọn)" />
      <div className="flex gap-2">
        <button
          type="button"
          className={buttonClass("primary")}
          onClick={() => {
            act(c.code, { type: "remind", note: note.trim() });
            setOpen(false);
            setNote("");
            onDone("Đã gửi nhắc việc qua hệ thống và email");
          }}
        >
          <Mail className="h-4 w-4" /> Gửi nhắc
        </button>
        <button type="button" className={buttonClass("ghost")} onClick={() => setOpen(false)}>
          Hủy
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// Read-only blocks
// ---------------------------------------------------------------------------------------------

function Info({ label, children, wide }: { label: string; children: ReactNode; wide?: boolean }) {
  return (
    <div className={wide ? "md:col-span-2" : ""}>
      <dt className="text-xs font-medium text-slate-500">{label}</dt>
      <dd className="mt-0.5 whitespace-pre-wrap text-sm text-slate-800">{children || <span className="text-slate-400">—</span>}</dd>
    </div>
  );
}

function RequestInfo({ c }: { c: FourMCase }) {
  return (
    <Card title="Thông tin yêu cầu">
      <dl className="grid gap-3 md:grid-cols-2">
        <Info label="4M Process" wide>
          {c.processText}
        </Info>
        <Info label="4M change class">
          <span className="flex flex-wrap gap-1">
            {c.classes.map((k) => (
              <Badge key={k}>{classOptions.find((o) => o.code === k)?.label ?? k}</Badge>
            ))}
          </span>
        </Info>
        <Info label="Expected change date">{c.expectedDate ? fmtDate(`${c.expectedDate}T03:00:00Z`, "vi") : ""}</Info>
        <Info label="Current Situation" wide>
          {c.situation}
        </Info>
        <Info label="Detail of Change" wide>
          {c.detail}
        </Info>
        <Info label="Purpose" wide>
          {c.purpose}
        </Info>
      </dl>
    </Card>
  );
}

function RelatedTable({ c }: { c: FourMCase }) {
  const phase = c.sim.step === "rrelsec" || (c.sim.visited.includes("rrelsec") && c.sim.step !== "relsec") ? "Xác nhận kết quả" : "Thẩm định";
  return (
    <Card title={`Phòng ban liên quan (${c.rows.length})${c.sim.round ? ` · ${phase} vòng ${c.sim.round}` : ""}`}>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-slate-200 text-slate-500">
            <tr>
              <th className="px-2 py-2 font-medium">Phòng ban</th>
              <th className="px-2 py-2 font-medium">Trạng thái</th>
              {YN_KEYS.map(([k, l]) => (
                <th key={k} className="px-2 py-2 text-center font-medium">
                  {l}
                </th>
              ))}
              <th className="px-2 py-2 font-medium">Ý kiến / cán bộ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {c.rows.map((r) => {
              const run = c.sim.runs.find((x) => x.code === r.code);
              const [label, tone] = run ? runLabel[run.status] : ["Chưa đến lượt", "gray" as const];
              const done = c.staffDone[r.code] ?? [];
              return (
                <tr key={r.code} className="align-top">
                  <td className="px-2 py-2">
                    <Link href={`/4m/cases?view=all&rsec=${r.code}`} className="font-medium text-slate-800 hover:text-blue-700">
                      {sectionLabel(r.code)}
                    </Link>
                    <span className="block text-slate-500">{personName(managerOf(r.code))}</span>
                  </td>
                  <td className="px-2 py-2">
                    <Badge tone={tone}>{label}</Badge>
                  </td>
                  {YN_KEYS.map(([k]) => (
                    <td key={k} className={`px-2 py-2 text-center font-semibold ${r[k] === "Y" ? "text-blue-700" : "text-slate-400"}`}>
                      {r[k] || "—"}
                    </td>
                  ))}
                  <td className="px-2 py-2 text-slate-600">
                    {r.opinion && <p className="whitespace-pre-wrap">{r.opinion}</p>}
                    {run?.staff.map((p) => (
                      <p key={p} className="mt-0.5 flex items-start gap-1">
                        {done.includes(p) || run.status === "recheck" || run.status === "approved" ? <Check className="mt-0.5 h-3 w-3 shrink-0 text-emerald-600" /> : <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-violet-400" />}
                        <span>
                          {personName(p)}
                          {c.staffNotes[`${r.code}:${p}`] ? `: ${c.staffNotes[`${r.code}:${p}`]}` : ""}
                        </span>
                      </p>
                    ))}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function EhsBlock({ c, editable, onDone }: { c: FourMCase; editable: boolean; onDone: (m: string) => void }) {
  const [v, setV] = useState<Record<string, string>>(c.ehs);
  const [editing, setEditing] = useState(false);
  const yn = (code: string) => code === "P4MForm_RelateSafe" || code === "P4MForm_EnvRelated";
  return (
    <Card
      title="Đánh giá rủi ro pháp lý (EHS)"
      actions={
        editable && !editing ? (
          <button type="button" className={buttonClass("ghost")} onClick={() => (setV(c.ehs), setEditing(true))}>
            Cập nhật
          </button>
        ) : (
          <span className="text-[11px] text-slate-400">Chỉ nhóm EHS (322A) cập nhật khi đang xử lý hồ sơ</span>
        )
      }
    >
      <dl className="grid gap-3 md:grid-cols-3">
        {riskFields.map((f) =>
          editing ? (
            <div key={f.code}>
              {yn(f.code) ? (
                <YNSelect label={f.label} value={(v[f.code] ?? "") as YN} onChange={(x) => setV({ ...v, [f.code]: x })} />
              ) : (
                <Field label={f.label}>
                  <input value={v[f.code] ?? ""} onChange={(e) => setV({ ...v, [f.code]: e.target.value })} className={inputClass} />
                </Field>
              )}
            </div>
          ) : (
            <Info key={f.code} label={f.label}>
              {c.ehs[f.code]}
            </Info>
          ),
        )}
      </dl>
      {editing && (
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            className={buttonClass("primary")}
            onClick={() => {
              act(c.code, { type: "ehs", values: v });
              setEditing(false);
              onDone("Đã cập nhật đánh giá EHS");
            }}
          >
            Lưu
          </button>
          <button type="button" className={buttonClass("ghost")} onClick={() => setEditing(false)}>
            Hủy
          </button>
        </div>
      )}
    </Card>
  );
}

function ResultBlock({ c }: { c: FourMCase }) {
  const r = c.result;
  return (
    <Card title="Kết quả thực hiện thay đổi">
      {r.actualDate ? (
        <dl className="grid gap-3 md:grid-cols-2">
          <Info label="Actual applied date">{fmtDate(`${r.actualDate}T03:00:00Z`, "vi")}</Info>
          <Info label="Have a problem">{r.haveProb === "Y" ? <Badge tone="amber">Có vấn đề</Badge> : <Badge tone="green">Không</Badge>}</Info>
          {r.haveProb === "Y" && (
            <>
              <Info label="Problem content" wide>
                {r.content}
              </Info>
              <Info label="Measure" wide>
                {r.measure}
              </Info>
            </>
          )}
        </dl>
      ) : (
        <p className="text-sm text-slate-500">Người đề nghị chưa nhập kết quả.</p>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------------------------------
// History / discussion / files / shares
// ---------------------------------------------------------------------------------------------

type Tab = "history" | "talk" | "files" | "shares";

function SideTabs({ c, onShare, onDone }: { c: FourMCase; onShare: () => void; onDone: (m: string) => void }) {
  const [tab, setTab] = useState<Tab>("history");
  const tabs: [Tab, string, number][] = [
    ["history", "Lịch sử", c.events.length],
    ["talk", "Trao đổi", c.comments.length],
    ["files", "Tệp", c.attachments.length],
    ["shares", "Chia sẻ", c.shares.length],
  ];
  return (
    <div className="rounded-lg border border-slate-200 bg-white">
      <div role="tablist" className="flex border-b border-slate-200 text-xs">
        {tabs.map(([id, label, n]) => (
          <button
            key={id}
            role="tab"
            type="button"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={`flex-1 border-b-2 px-2 py-2 font-medium ${tab === id ? "border-blue-600 text-blue-700" : "border-transparent text-slate-500 hover:text-slate-800"}`}
          >
            {label} <span className="text-slate-400">{n}</span>
          </button>
        ))}
      </div>
      <div className="max-h-[32rem] overflow-y-auto p-3">
        {tab === "history" && <History c={c} />}
        {tab === "talk" && <Talk c={c} onDone={onDone} />}
        {tab === "files" && <Files c={c} onDone={onDone} />}
        {tab === "shares" && <Shares c={c} onShare={onShare} />}
      </div>
    </div>
  );
}

function History({ c }: { c: FourMCase }) {
  return (
    <ol className="space-y-3">
      {[...c.events].reverse().map((e) => (
        <li key={e.id} className="flex gap-2 text-xs">
          <Avatar id={e.actor} />
          <div className="min-w-0 flex-1">
            <p className="text-slate-800">
              <b>{personName(e.actor)}</b> · {e.label}
            </p>
            <p className="text-slate-400">
              {dt(e.at)}
              {e.step ? ` · ${stepShort[e.step]}` : ""}
              {e.section ? ` · ${sectionShort(e.section)}` : ""}
            </p>
            {e.comment && <p className="mt-1 whitespace-pre-wrap rounded bg-slate-50 p-1.5 text-slate-700">“{e.comment}”</p>}
            {e.emails && e.emails.length > 0 && (
              <p className="mt-1 flex items-start gap-1 text-slate-400" title={e.emails.join(", ")}>
                <Mail className="mt-0.5 h-3 w-3 shrink-0" />
                <span className="truncate">Email: {e.emails.join(", ")}</span>
              </p>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}

function renderMentions(text: string) {
  const names = people.map((p) => `@${p.name}`).filter((n) => text.includes(n));
  if (names.length === 0) return text;
  const re = new RegExp(`(${names.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`, "g");
  return text.split(re).map((part, i) =>
    names.includes(part) ? (
      <span key={i} className="rounded bg-blue-50 px-0.5 font-medium text-blue-700">
        {part}
      </span>
    ) : (
      part
    ),
  );
}

function Talk({ c, onDone }: { c: FourMCase; onDone: (m: string) => void }) {
  const [text, setText] = useState("");
  return (
    <div className="space-y-3">
      {c.comments.length === 0 && <p className="text-xs text-slate-400">Chưa có trao đổi. Dùng @Tên để nhắc người khác – họ nhận thông báo ngay.</p>}
      {c.comments.map((m) => (
        <div key={m.id} className="flex gap-2 text-xs">
          <Avatar id={m.by} />
          <div className="min-w-0 flex-1">
            <p>
              <b className="text-slate-800">{personName(m.by)}</b> <span className="text-slate-400">{dt(m.at)}</span>
            </p>
            <p className="mt-0.5 whitespace-pre-wrap text-slate-700">{renderMentions(m.text)}</p>
          </div>
        </div>
      ))}
      <div className="space-y-2 border-t border-slate-100 pt-3">
        <textarea rows={3} value={text} onChange={(e) => setText(e.target.value)} className={inputClass} placeholder="Viết trao đổi… dùng @Tên để nhắc" aria-label="Nội dung trao đổi" />
        <div className="flex items-center gap-2">
          <select
            aria-label="Nhắc tên"
            className={`${inputClass} w-auto text-xs`}
            value=""
            onChange={(e) => e.target.value && setText(`${text}${text && !text.endsWith(" ") ? " " : ""}@${personName(e.target.value)} `)}
          >
            <option value="">@ Nhắc tên…</option>
            {participants(c).map((p) => (
              <option key={p} value={p}>
                {personName(p)}
              </option>
            ))}
          </select>
          <button
            type="button"
            className={`${buttonClass("primary")} ml-auto`}
            disabled={!text.trim()}
            onClick={() => {
              act(c.code, { type: "comment", text: text.trim() });
              setText("");
              onDone("Đã gửi trao đổi");
            }}
          >
            <MessageSquare className="h-4 w-4" /> Gửi
          </button>
        </div>
      </div>
    </div>
  );
}

function Files({ c, onDone }: { c: FourMCase; onDone: (m: string) => void }) {
  return (
    <div className="space-y-2">
      {c.attachments.length === 0 && <p className="text-xs text-slate-400">Chưa có tệp đính kèm.</p>}
      <ul className="space-y-1.5">
        {c.attachments.map((a, i) => (
          <li key={i} className="flex items-center gap-2 text-xs">
            <Paperclip className="h-3.5 w-3.5 shrink-0 text-slate-400" />
            <span className="min-w-0 flex-1 truncate font-medium text-slate-700">{a.name}</span>
            <span className="text-slate-400">{a.size}</span>
            <span className="text-slate-400" title={dt(a.at)}>
              {personName(a.by).split(" ").pop()}
            </span>
          </li>
        ))}
      </ul>
      <label className={`${buttonClass("ghost")} cursor-pointer`}>
        <Paperclip className="h-4 w-4" /> Thêm tệp
        <input
          type="file"
          multiple
          className="sr-only"
          onChange={(e) => {
            const files = Array.from(e.target.files ?? []);
            files.forEach((f) => act(c.code, { type: "attach", name: f.name, size: f.size > 1e6 ? `${(f.size / 1e6).toFixed(1)} MB` : `${Math.max(1, Math.round(f.size / 1e3))} KB` }));
            if (files.length) onDone(`Đã đính kèm ${files.length} tệp`);
            e.target.value = "";
          }}
        />
      </label>
    </div>
  );
}

function Shares({ c, onShare }: { c: FourMCase; onShare: () => void }) {
  return (
    <div className="space-y-3">
      {c.shares.length === 0 && <p className="text-xs text-slate-400">Chưa chia sẻ cho ai.</p>}
      {[...c.shares].reverse().map((s, i) => (
        <div key={i} className="rounded-md border border-slate-100 p-2 text-xs">
          <p className="text-slate-500">
            <b className="text-slate-700">{personName(s.by)}</b> · {dt(s.at)}
          </p>
          <p className="mt-1 flex flex-wrap gap-1">
            {s.to.map((p) => (
              <Badge key={p} tone="blue">
                {personName(p)}
              </Badge>
            ))}
            {s.emails.map((m) => (
              <Badge key={m}>
                <Mail className="mr-1 h-3 w-3" />
                {m}
              </Badge>
            ))}
          </p>
          {s.note && <p className="mt-1 text-slate-600">“{s.note}”</p>}
        </div>
      ))}
      <button type="button" className={buttonClass()} onClick={onShare}>
        <Share2 className="h-4 w-4" /> Chia sẻ thêm
      </button>
    </div>
  );
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function ShareDialog({ c, me, onClose, onDone }: { c: FourMCase; me: string; onClose: () => void; onDone: (m: string) => void }) {
  const [q, setQ] = useState("");
  const [to, setTo] = useState<string[]>([]);
  const [emailText, setEmailText] = useState("");
  const [note, setNote] = useState("");
  const [sendMail, setSendMail] = useState(true);
  const [error, setError] = useState("");
  const already = new Set(c.shares.flatMap((s) => s.to));
  const fq = q.trim().toLowerCase();
  const list = people.filter((p) => p.id !== me && (!fq || `${p.name} ${p.email} ${sectionShort(p.section)} ${p.title}`.toLowerCase().includes(fq)));
  const emails = emailText
    .split(/[,;\s]+/)
    .map((x) => x.trim())
    .filter(Boolean);

  function submit() {
    const bad = emails.filter((m) => !EMAIL_RE.test(m));
    if (bad.length) return setError(`Email không hợp lệ: ${bad.join(", ")}`);
    if (to.length + emails.length === 0) return setError("Chọn ít nhất 1 người hoặc nhập email.");
    act(c.code, { type: "share", to, emails, note: note.trim(), email: sendMail });
    onDone(`Đã chia sẻ cho ${to.length + emails.length} người nhận${sendMail || emails.length ? " · đã gửi email" : ""}`);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" role="dialog" aria-modal="true" aria-label="Chia sẻ hồ sơ" onClick={onClose}>
      <div className="w-full max-w-lg rounded-lg bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-900">Chia sẻ {c.code}</h2>
          <button type="button" aria-label="Đóng" onClick={onClose}>
            <X className="h-4 w-4 text-slate-500" />
          </button>
        </div>
        <div className="space-y-3 p-4">
          <div>
            <input value={q} onChange={(e) => setQ(e.target.value)} className={inputClass} placeholder="Tìm người theo tên, email, phòng…" aria-label="Tìm người" autoFocus />
            {to.length > 0 && (
              <p className="mt-2 flex flex-wrap gap-1">
                {to.map((p) => (
                  <span key={p} className="flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-800">
                    {personName(p)}
                    <button type="button" aria-label={`Bỏ ${personName(p)}`} onClick={() => setTo(to.filter((x) => x !== p))}>
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </p>
            )}
            <ul className="mt-2 max-h-48 divide-y divide-slate-100 overflow-y-auto rounded-md border border-slate-200">
              {list.map((p) => (
                <li key={p.id}>
                  <label className="flex cursor-pointer items-center gap-2 px-2 py-1.5 text-xs hover:bg-slate-50">
                    <input type="checkbox" checked={to.includes(p.id)} onChange={(e) => setTo(e.target.checked ? [...to, p.id] : to.filter((x) => x !== p.id))} />
                    <Avatar id={p.id} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium text-slate-800">{p.name}</span>
                      <span className="block truncate text-slate-500">
                        {p.title} · {p.email}
                      </span>
                    </span>
                    {already.has(p.id) && <Badge>đã chia sẻ</Badge>}
                  </label>
                </li>
              ))}
            </ul>
          </div>
          <Field label="Email ngoài danh bạ (phân cách bằng dấu phẩy)">
            <input value={emailText} onChange={(e) => setEmailText(e.target.value)} className={inputClass} placeholder="supplier@example.com, qa.hq@bridgestone.com" />
          </Field>
          <Field label="Lời nhắn">
            <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} className={inputClass} />
          </Field>
          <label className="flex items-center gap-2 text-xs text-slate-700">
            <input type="checkbox" checked={sendMail} onChange={(e) => setSendMail(e.target.checked)} />
            Gửi email cho người trong danh bạ (email ngoài danh bạ luôn được gửi)
          </label>
          <p className="text-[11px] text-slate-500">Người được chia sẻ xem được hồ sơ, tự động theo dõi và nhận thông báo khi hồ sơ chuyển bước. Họ không có quyền phê duyệt.</p>
          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-200 px-4 py-3">
          <button type="button" className={buttonClass("ghost")} onClick={onClose}>
            Hủy
          </button>
          <button type="button" className={buttonClass("primary")} onClick={submit}>
            <Share2 className="h-4 w-4" /> Chia sẻ ({to.length + emails.length})
          </button>
        </div>
      </div>
    </div>
  );
}
