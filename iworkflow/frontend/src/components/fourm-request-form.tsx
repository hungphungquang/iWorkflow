"use client";

import { useState } from "react";
import { ArrowRight, Paperclip, Plus, Trash2, X } from "lucide-react";
import { Badge, Card, Field, buttonClass, inputClass } from "@/components/ui";
import { classOptions, relatedSectionColumns, sections } from "@/lib/fourm";
import { emptyRow, sectionLabel, sectionShort, type RelatedRow, type RequestData } from "@/lib/fourm-case";
import { gmOf, managerOf, personName } from "@/lib/people";

const REQUIRED: [keyof RequestData, string][] = [
  ["title", "Title"],
  ["processText", "4M Process"],
  ["situation", "Current Situation"],
  ["detail", "Detail of Change"],
  ["purpose", "Purpose"],
  ["expectedDate", "Expected change date"],
];

export const blankRequest = (): RequestData => ({ title: "", processText: "", classes: [], situation: "", detail: "", purpose: "", expectedDate: "", rows: [emptyRow("3221"), emptyRow("3211")] });

export function FourMRequestForm({
  initial,
  section,
  requesterName,
  submitLabel,
  withComment,
  onSubmit,
  onCancel,
}: {
  initial: RequestData;
  section: string;
  requesterName: string;
  submitLabel: string;
  withComment?: boolean;
  onSubmit: (data: RequestData, attachments: string[], comment: string) => void;
  onCancel?: () => void;
}) {
  const [d, setD] = useState<RequestData>(initial);
  const [files, setFiles] = useState<string[]>([]);
  const [comment, setComment] = useState("");
  const [errors, setErrors] = useState<string[]>([]);
  const set = <K extends keyof RequestData>(k: K, v: RequestData[K]) => setD({ ...d, [k]: v });
  const setRow = (i: number, code: string) => set("rows", d.rows.map((r, j): RelatedRow => (j === i ? { ...emptyRow(code), ...(r.code === code ? r : {}) } : r)));
  const available = sections.filter((s) => s.code !== section);
  const chosen = d.rows.map((r) => r.code).filter(Boolean);

  function submit() {
    const missing = REQUIRED.filter(([k]) => !String(d[k]).trim()).map(([, l]) => l);
    if (d.classes.length === 0) missing.push("4M change class");
    if (chosen.length === 0) missing.push("Phòng ban liên quan (ít nhất 1)");
    if (chosen.length !== d.rows.length) missing.push("Dòng phòng ban chưa chọn");
    if (new Set(chosen).size !== chosen.length) missing.push("Phòng ban bị trùng");
    setErrors(missing);
    if (missing.length === 0) onSubmit({ ...d, rows: d.rows.filter((r) => r.code) }, files, comment.trim());
  }

  return (
    <form
      className="grid gap-4 xl:grid-cols-[1fr_20rem]"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <div className="min-w-0 space-y-4">
        <Card title="Thông tin yêu cầu">
          <div className="grid gap-3 md:grid-cols-4">
            <Field label="Title" span={4} required>
              <input value={d.title} onChange={(e) => set("title", e.target.value)} className={inputClass} placeholder="Tiêu đề thay đổi" />
            </Field>
            <Field label="4M Process" span={4} required>
              <input value={d.processText} onChange={(e) => set("processText", e.target.value)} className={inputClass} placeholder="Công đoạn / quy trình bị thay đổi" />
            </Field>
            <div className="md:col-span-2">
              <p className="mb-1 text-xs font-medium text-slate-600">
                4M change class <span className="text-red-500">*</span>
              </p>
              <div className="flex flex-wrap gap-2">
                {classOptions.map((c) => {
                  const on = d.classes.includes(c.code);
                  return (
                    <label key={c.code} className={`flex cursor-pointer items-center gap-1.5 rounded-md border px-2 py-1 text-xs ${on ? "border-blue-400 bg-blue-50 text-blue-800" : "border-slate-300 text-slate-700"}`}>
                      <input type="checkbox" className="sr-only" checked={on} onChange={(e) => set("classes", e.target.checked ? [...d.classes, c.code] : d.classes.filter((x) => x !== c.code))} />
                      {c.label}
                    </label>
                  );
                })}
              </div>
            </div>
            <Field label="Expected change date" span={2} required>
              <input type="date" value={d.expectedDate} onChange={(e) => set("expectedDate", e.target.value)} className={inputClass} />
            </Field>
            <Field label="Current Situation" span={4} required>
              <textarea rows={3} value={d.situation} onChange={(e) => set("situation", e.target.value)} className={inputClass} />
            </Field>
            <Field label="Detail of Change" span={4} required>
              <textarea rows={3} value={d.detail} onChange={(e) => set("detail", e.target.value)} className={inputClass} />
            </Field>
            <Field label="Purpose" span={4} required>
              <textarea rows={2} value={d.purpose} onChange={(e) => set("purpose", e.target.value)} className={inputClass} />
            </Field>
            <Field label="Người khởi tạo" span={2}>
              <input className={`${inputClass} bg-slate-50`} value={requesterName} readOnly />
            </Field>
            <Field label="Đơn vị đề nghị" span={2}>
              <input className={`${inputClass} bg-slate-50`} value={sectionLabel(section)} readOnly />
            </Field>
          </div>
        </Card>

        <Card
          title={`Phòng ban liên quan (${chosen.length})`}
          actions={
            <button type="button" className={buttonClass("ghost")} onClick={() => set("rows", [...d.rows, emptyRow("")])}>
              <Plus className="h-4 w-4" /> Thêm phòng ban
            </button>
          }
        >
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 text-slate-500">
                <tr>
                  {relatedSectionColumns.map((c) => (
                    <th key={c.code} className="px-2 py-2 font-medium" title={c.code}>
                      {c.label}
                      <span className="block text-[10px] font-normal text-slate-400">{c.note}</span>
                    </th>
                  ))}
                  <th className="px-2 py-2 font-medium">Người nhận</th>
                  <th />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {d.rows.map((r, i) => (
                  <tr key={i}>
                    <td className="px-2 py-1.5">
                      <select aria-label="Phòng ban xử lý" className={inputClass} value={r.code} onChange={(e) => setRow(i, e.target.value)}>
                        <option value="">— Chọn —</option>
                        {available.map((s) => (
                          <option key={s.code} value={s.code} disabled={chosen.includes(s.code) && s.code !== r.code}>
                            {s.code} – {s.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    {(["risk", "std", "initial", "cancel"] as const).map((k) => (
                      <td key={k} className="px-2 py-1.5 text-slate-400">
                        {r[k] || "—"}
                      </td>
                    ))}
                    <td className="px-2 py-1.5 text-slate-600">{r.code ? personName(managerOf(r.code)) : "—"}</td>
                    <td className="px-2 py-1.5">
                      <button type="button" aria-label="Xóa dòng" className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600" onClick={() => set("rows", d.rows.filter((_, j) => j !== i))}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-slate-500">Mỗi dòng sinh một quy trình con RelSecProc_2510 chạy song song; trưởng phòng của phòng đó điền các cột Y/N khi thẩm định.</p>
        </Card>

        <Card title="Tài liệu đính kèm">
          <label className="flex h-20 cursor-pointer items-center justify-center rounded-md border-2 border-dashed border-slate-300 bg-slate-50 text-sm text-slate-500 hover:border-blue-400 hover:text-blue-600">
            <Paperclip className="mr-1.5 h-4 w-4" /> Chọn hoặc kéo thả tệp (bản vẽ, WS, kết quả thử nghiệm)
            <input type="file" multiple className="sr-only" onChange={(e) => setFiles([...files, ...Array.from(e.target.files ?? []).map((f) => f.name)])} />
          </label>
          {files.length > 0 && (
            <ul className="mt-2 flex flex-wrap gap-2 text-xs">
              {files.map((f, i) => (
                <li key={i} className="flex items-center gap-1 rounded bg-slate-100 px-2 py-0.5 text-slate-700">
                  {f}
                  <button type="button" aria-label={`Bỏ ${f}`} onClick={() => setFiles(files.filter((_, j) => j !== i))}>
                    <X className="h-3 w-3" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="space-y-4">
        <Card title="Luồng phê duyệt dự kiến">
          <ol className="space-y-2 text-xs">
            <li>
              <b className="text-slate-800">1. {personName(managerOf(section))}</b>
              <span className="block text-slate-500">Trưởng phòng đề nghị kiểm tra · 2 ngày · duyệt được qua email</span>
            </li>
            <li>
              <b className="text-slate-800">2. {personName(gmOf(section))}</b>
              <span className="block text-slate-500">GM phê duyệt · 2 ngày{gmOf(section) === managerOf(section) ? " · cùng người với bước 1" : ""}</span>
            </li>
            <li>
              <b className="text-slate-800">3. {chosen.length} phòng liên quan song song</b>
              <span className="mt-1 flex flex-wrap gap-1">
                {chosen.map((c) => (
                  <Badge key={c}>{sectionShort(c)}</Badge>
                ))}
              </span>
            </li>
            <li className="flex items-center gap-1 text-slate-500">
              <ArrowRight className="h-3.5 w-3.5" /> Giai đoạn 2: nhập kết quả sau ngày thay đổi dự kiến
            </li>
          </ol>
        </Card>
        {withComment && (
          <Card title="Ghi chú khi gửi lại">
            <textarea rows={3} value={comment} onChange={(e) => setComment(e.target.value)} className={inputClass} placeholder="Đã chỉnh sửa những gì theo yêu cầu…" />
          </Card>
        )}
        {errors.length > 0 && (
          <div className="rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-700" role="alert">
            Cần bổ sung: {errors.join(", ")}
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          <button type="submit" className={buttonClass("primary")}>
            {submitLabel}
          </button>
          {onCancel && (
            <button type="button" className={buttonClass()} onClick={onCancel}>
              Hủy
            </button>
          )}
        </div>
      </div>
    </form>
  );
}
