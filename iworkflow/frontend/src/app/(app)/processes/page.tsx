import Link from "next/link";
import { Badge, Card, PageHeader, Placeholder, WireNote, buttonClass, inputClass } from "@/components/ui";
import { processes } from "@/lib/mock";

const palette = ["Start event", "User task", "Service task", "Exclusive gateway", "Parallel gateway", "Call activity", "Sub-process", "Timer", "End event"];

export default function ProcessesPage() {
  const selected = processes.find((p) => p.key === "Uniform_Request")!;
  return (
    <>
      <PageHeader
        title="Quy trình"
        description="Danh sách định nghĩa quy trình, phiên bản và trình thiết kế BPMN"
        actions={
          <>
            <button className={buttonClass()}>Import BPMN</button>
            <button className={buttonClass("primary")}>+ Quy trình mới</button>
          </>
        }
      />
      <div className="grid gap-4 xl:grid-cols-[22rem_1fr]">
        <Card title={`Định nghĩa (${processes.length})`}>
          <input className={`${inputClass} mb-3`} placeholder="Tìm quy trình…" />
          <ul className="max-h-[32rem] divide-y divide-slate-100 overflow-y-auto">
            {processes.map((p) => (
              <li key={p.key} className={`flex items-center gap-2 px-2 py-2 ${p.key === selected.key ? "rounded-md bg-blue-50" : ""}`}>
                <span className="min-w-0 flex-1">
                  {p.key === "Process4MChange" ? (
                    <Link href="/processes/4m" className="block truncate text-sm font-medium text-blue-700 hover:underline">
                      {p.name} → phân tích
                    </Link>
                  ) : (
                    <span className="block truncate text-sm font-medium text-slate-800">{p.name}</span>
                  )}
                  <span className="block truncate font-mono text-[11px] text-slate-500">
                    {p.key} · v{p.version}
                  </span>
                </span>
                {p.migrated ? <Badge tone="blue">Flowable</Badge> : <Badge tone="violet">Activiti 5</Badge>}
              </li>
            ))}
          </ul>
        </Card>

        <div className="space-y-4">
          <Card
            title={`${selected.name} · v${selected.version}`}
            actions={
              <div className="flex gap-2">
                <button className={buttonClass("ghost")}>Lịch sử phiên bản</button>
                <button className={buttonClass()}>Lưu nháp</button>
                <button className={buttonClass("primary")}>Triển khai (deploy)</button>
              </div>
            }
          >
            <div className="grid gap-3 lg:grid-cols-[9rem_1fr_15rem]">
              <div className="space-y-1">
                <p className="text-[11px] font-semibold uppercase text-slate-400">Bảng phần tử</p>
                {palette.map((p) => (
                  <div key={p} className="rounded border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-600">
                    {p}
                  </div>
                ))}
              </div>
              <Placeholder label="Canvas thiết kế BPMN (bpmn-js) – kéo thả, zoom, kiểm tra lỗi" className="h-[26rem]" />
              <div className="space-y-3 text-xs">
                <p className="text-[11px] font-semibold uppercase text-slate-400">Thuộc tính bước đang chọn</p>
                <label className="block space-y-1">
                  <span className="text-slate-600">Tên bước</span>
                  <input className={inputClass} defaultValue="Manager Approve Uniform Request" />
                </label>
                <label className="block space-y-1">
                  <span className="text-slate-600">Biểu mẫu (form key)</span>
                  <input className={inputClass} defaultValue="Uniform_Request_Read#P4M_Button_PDTC" />
                </label>
                <label className="block space-y-1">
                  <span className="text-slate-600">Người xử lý</span>
                  <select className={inputClass} defaultValue="mgr">
                    <option value="mgr">Trưởng bộ phận của người tạo</option>
                    <option>Nhóm cố định</option>
                    <option>Biểu thức</option>
                  </select>
                </label>
                <label className="block space-y-1">
                  <span className="text-slate-600">Hạn xử lý (SLA)</span>
                  <input className={inputClass} defaultValue="3 ngày làm việc" />
                </label>
                <label className="flex items-center gap-2 text-slate-600">
                  <input type="checkbox" defaultChecked /> Gửi email khi giao việc
                </label>
              </div>
            </div>
          </Card>
          <WireNote>
            Thay Activiti Modeler (Oryx) bằng <b>bpmn-js</b>. 29 quy trình đang dùng được import từ BPMN đang chạy trên prod và deploy lại lên Flowable. Quy trình nhãn “Activiti 5” vẫn chạy ở hệ cũ, chỉ xem.
          </WireNote>
        </div>
      </div>
    </>
  );
}
