import Link from "next/link";
import { notFound } from "next/navigation";
import { Check, ChevronLeft, Circle, FileText, Paperclip } from "lucide-react";
import { Badge, Card, Field, Placeholder, SourceBadge, StatusBadge, WireNote, inputClass } from "@/components/ui";
import { processByKey, taskById, tasks } from "@/lib/mock";
import { TaskActions } from "./task-actions";

export function generateStaticParams() {
  return tasks.map((t) => ({ id: t.id }));
}

const steps = [
  { name: "Tạo yêu cầu", who: "Trần Thị Mai", when: "28/10 09:12", state: "done" },
  { name: "Trưởng bộ phận phê duyệt", who: "Bạn", when: "đang xử lý", state: "current" },
  { name: "GA Staff kiểm tra", who: "Nhóm GA Staff", when: "", state: "todo" },
  { name: "GM phê duyệt", who: "Nhóm GM", when: "", state: "todo" },
  { name: "Người yêu cầu xác nhận nhận hàng", who: "Trần Thị Mai", when: "tự đóng sau 7 ngày", state: "todo" },
] as const;

const history = [
  { who: "Trần Thị Mai", what: "Tạo hồ sơ và gửi phê duyệt", when: "28/10/2026 09:12" },
  { who: "Hệ thống", what: "Giao việc cho Nguyễn An (Trưởng phòng 151A), gửi email thông báo", when: "28/10/2026 09:12" },
  { who: "Lê Thu Trang", what: "Bình luận: “Bổ sung size cho 2 người mới vào ca C”", when: "29/10/2026 14:03" },
];

const items = [
  { name: "Áo khoác đông", size: "M", qty: 8 },
  { name: "Áo khoác đông", size: "L", qty: 5 },
  { name: "Giày bảo hộ", size: "41", qty: 3 },
];

export default async function TaskDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const task = taskById(id);
  if (!task) notFound();
  const process = processByKey(task.processKey);

  return (
    <>
      <Link href="/tasks" className="mb-3 inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800">
        <ChevronLeft className="h-3.5 w-3.5" /> Hộp việc
      </Link>

      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-sm text-slate-500">{task.code}</span>
            <SourceBadge source={task.source} />
            <StatusBadge status={task.status} />
          </div>
          <h1 className="mt-1 text-xl font-semibold text-slate-900">{task.title}</h1>
          <p className="mt-1 text-sm text-slate-500">
            {process?.name} · v{process?.version} · Bước: <b className="text-slate-700">{task.step}</b>
          </p>
        </div>
        <div className="text-right text-xs text-slate-500">
          <p>
            Người tạo: <b className="text-slate-700">{task.requester}</b>
          </p>
          <p>Ngày tạo: {task.created.split("-").reverse().join("/")}</p>
          {task.processKey === "Process4MChange" && (
            <Link href="/processes/4m/simulate" className="mt-1 inline-block text-blue-600 hover:underline">
              Xem luồng 4M chi tiết →
            </Link>
          )}
          <p>Hạn xử lý: {task.due.split("-").reverse().join("/")}</p>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_20rem]">
        <div className="space-y-4">
          <Card title="Thông tin yêu cầu" actions={<Badge>Biểu mẫu: Uniform_Request_Read</Badge>}>
            <div className="grid gap-4 md:grid-cols-4">
              <Field label="Bộ phận yêu cầu" span={2}>
                <input className={inputClass} defaultValue="8511 · Sản xuất 1" readOnly />
              </Field>
              <Field label="Ngày cần" span={1}>
                <input className={inputClass} defaultValue="15/11/2026" readOnly />
              </Field>
              <Field label="Loại yêu cầu" span={1}>
                <input className={inputClass} defaultValue="Cấp mới theo mùa" readOnly />
              </Field>
              <Field label="Lý do" span={4}>
                <textarea className={inputClass} rows={2} defaultValue="Cấp đồng phục mùa đông cho tổ sơ chế ca B, C." readOnly />
              </Field>
            </div>
          </Card>

          <Card title="Danh sách vật phẩm (sub-form)">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 text-left text-xs uppercase text-slate-500">
                <tr>
                  <th className="py-2 font-medium">#</th>
                  <th className="py-2 font-medium">Vật phẩm</th>
                  <th className="py-2 font-medium">Size</th>
                  <th className="py-2 text-right font-medium">Số lượng</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((it, i) => (
                  <tr key={i}>
                    <td className="py-2 text-slate-500">{i + 1}</td>
                    <td className="py-2">{it.name}</td>
                    <td className="py-2">{it.size}</td>
                    <td className="py-2 text-right">{it.qty}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-slate-200 font-medium">
                  <td colSpan={3} className="py-2 text-right text-slate-600">
                    Tổng (công thức)
                  </td>
                  <td className="py-2 text-right">16</td>
                </tr>
              </tfoot>
            </table>
          </Card>

          <Card title="Ý kiến của bạn (bước hiện tại)">
            <div className="mb-4 grid gap-4 md:grid-cols-4">
              <Field label="Số lượng duyệt" required>
                <input className={inputClass} defaultValue="16" />
              </Field>
              <Field label="Ngân sách" span={2}>
                <select className={inputClass} defaultValue="GA-2026-UNI">
                  <option value="GA-2026-UNI">GA-2026-UNI · Đồng phục 2026</option>
                </select>
              </Field>
            </div>
            <TaskActions />
          </Card>

          <WireNote>
            Biểu mẫu được <b>render tự động</b> từ cấu hình hiện có (BIEU_MAU / BM_HANG / BM_O / TRUONG_THONG_TIN) – không phải code tay từng form. Ba nút xử lý tương ứng biến nút của quy trình (vd. <code>P4M_Button_PDTC</code> = PD / YCCS / TC) và đi theo nhánh gateway giống hệ cũ.
          </WireNote>
        </div>

        <div className="space-y-4">
          <Card title="Tiến trình">
            <ol className="space-y-3">
              {steps.map((s) => (
                <li key={s.name} className="flex gap-2.5">
                  {s.state === "done" ? (
                    <Check className="mt-0.5 h-4 w-4 shrink-0 rounded-full bg-emerald-500 p-0.5 text-white" />
                  ) : s.state === "current" ? (
                    <Circle className="mt-0.5 h-4 w-4 shrink-0 fill-blue-500 text-blue-500" />
                  ) : (
                    <Circle className="mt-0.5 h-4 w-4 shrink-0 text-slate-300" />
                  )}
                  <div className="text-xs">
                    <p className={`font-medium ${s.state === "current" ? "text-blue-700" : "text-slate-700"}`}>{s.name}</p>
                    <p className="text-slate-500">
                      {s.who}
                      {s.when && ` · ${s.when}`}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
            <Link href="/processes" className="mt-3 block text-xs text-blue-600 hover:underline">
              Xem sơ đồ BPMN →
            </Link>
          </Card>

          <Card title="Tệp đính kèm" actions={<button className="text-xs text-blue-600">+ Thêm</button>}>
            <ul className="space-y-2 text-xs">
              <li className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-red-500" /> Danh_sach_size_ca_B.pdf <span className="ml-auto text-slate-400">220 KB</span>
              </li>
              <li className="flex items-center gap-2">
                <Paperclip className="h-4 w-4 text-slate-400" /> Bao_gia_NCC.xlsx <span className="ml-auto text-slate-400">48 KB</span>
              </li>
            </ul>
          </Card>

          <Card title="Lịch sử & bình luận">
            <ul className="space-y-3 text-xs">
              {history.map((h, i) => (
                <li key={i} className="border-l-2 border-slate-200 pl-3">
                  <p className="text-slate-700">
                    <b>{h.who}</b> – {h.what}
                  </p>
                  <p className="text-slate-400">{h.when}</p>
                </li>
              ))}
            </ul>
            <textarea className={`${inputClass} mt-3`} rows={2} placeholder="Viết bình luận, @nhắc tên…" />
          </Card>

          <Placeholder label="Sơ đồ quy trình thu nhỏ (bpmn-js viewer, tô bước hiện tại)" className="h-40" />
        </div>
      </div>
    </>
  );
}
