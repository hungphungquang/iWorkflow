import Link from "next/link";
import { Download } from "lucide-react";
import { Badge, Card, PageHeader, SourceBadge, WireNote, buttonClass, inputClass } from "@/components/ui";
import { processByKey, processes, tasks } from "@/lib/mock";

const cases = [
  ...tasks.map((t) => ({ ...t, state: "Đang xử lý" as const })),
  { id: "c-2001", code: "GA-2025-0981", title: "Cấp đồng phục quý 4/2025", processKey: "Uniform_Request", step: "—", requester: "Trần Thị Mai", created: "2025-10-02", source: "legacy" as const, state: "Hoàn tất" as const },
  { id: "c-2002", code: "ENG-2025-217", title: "Thay đổi 4M – khuôn ép số 7", processKey: "Process4MChange", step: "—", requester: "Phạm Quốc Bảo", created: "2025-06-19", source: "legacy" as const, state: "Đã hủy" as const },
];

const stateTone = { "Đang xử lý": "blue", "Hoàn tất": "green", "Đã hủy": "gray" } as const;

export default function CasesPage() {
  return (
    <>
      <PageHeader
        title="Tra cứu hồ sơ"
        description="Tìm trên toàn bộ hồ sơ (17.288 hồ sơ hệ cũ + hồ sơ hệ mới) theo quyền xem của bạn"
        actions={
          <button className={buttonClass()}>
            <Download className="h-4 w-4" /> Xuất Excel
          </button>
        }
      />

      <Card>
        <div className="grid gap-3 md:grid-cols-4">
          <input className={inputClass} placeholder="Mã hồ sơ (vd. GA-2026-1158)" />
          <input className={inputClass} placeholder="Tiêu đề / nội dung" />
          <select className={inputClass} defaultValue="">
            <option value="">Tất cả quy trình</option>
            {processes.map((p) => (
              <option key={p.key}>{p.name}</option>
            ))}
          </select>
          <select className={inputClass} defaultValue="">
            <option value="">Mọi trạng thái</option>
            <option>Đang xử lý</option>
            <option>Hoàn tất</option>
            <option>Đã hủy</option>
          </select>
          <input className={inputClass} placeholder="Người tạo" />
          <input className={inputClass} placeholder="Bộ phận" />
          <input className={inputClass} type="date" aria-label="Từ ngày" />
          <input className={inputClass} type="date" aria-label="Đến ngày" />
        </div>
        <div className="mt-3 flex gap-2">
          <button className={buttonClass("primary")}>Tìm kiếm</button>
          <button className={buttonClass("ghost")}>Xóa điều kiện</button>
          <button className={buttonClass("ghost")}>Lưu bộ lọc…</button>
        </div>
      </Card>

      <Card className="mt-4" title={`Kết quả (${cases.length})`}>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-3 py-2 font-medium">Mã hồ sơ</th>
                <th className="px-3 py-2 font-medium">Tiêu đề</th>
                <th className="px-3 py-2 font-medium">Quy trình</th>
                <th className="px-3 py-2 font-medium">Người tạo</th>
                <th className="px-3 py-2 font-medium">Ngày tạo</th>
                <th className="px-3 py-2 font-medium">Trạng thái</th>
                <th className="px-3 py-2 font-medium">Nguồn</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {cases.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50">
                  <td className="px-3 py-2.5 font-mono text-xs">
                    <Link href={c.id.startsWith("t-") ? `/tasks/${c.id}` : "#"} className="text-blue-700 hover:underline">
                      {c.code}
                    </Link>
                  </td>
                  <td className="max-w-xs truncate px-3 py-2.5 font-medium text-slate-800">{c.title}</td>
                  <td className="max-w-[14rem] truncate px-3 py-2.5 text-slate-600">{processByKey(c.processKey)?.name}</td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-slate-600">{c.requester}</td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-slate-600">{c.created.split("-").reverse().join("/")}</td>
                  <td className="px-3 py-2.5">
                    <Badge tone={stateTone[c.state]}>{c.state}</Badge>
                  </td>
                  <td className="px-3 py-2.5">
                    <SourceBadge source={c.source} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
          <span>Hiển thị 1–10</span>
          <span className="flex gap-1">
            <button className={buttonClass("ghost")}>‹ Trước</button>
            <button className={buttonClass("ghost")}>Sau ›</button>
          </span>
        </div>
      </Card>

      <div className="mt-4">
        <WireNote>
          Tìm kiếm thay cho màn “tim-kiem” + “my-process-instances” cũ: lọc và phân trang phía server, tìm toàn văn trong nội dung biểu mẫu (thay Solr không còn chạy). Kết quả chỉ gồm hồ sơ người dùng có quyền xem theo đơn vị.
        </WireNote>
      </div>
    </>
  );
}
