import Link from "next/link";
import { ArrowRight, Star } from "lucide-react";
import { Badge, Card, PageHeader, WireNote, inputClass } from "@/components/ui";
import { processes, type ProcessGroup } from "@/lib/mock";

const groups: ProcessGroup[] = ["Hành chính – Nhân sự", "Sản xuất & Chất lượng", "Mua hàng – Tài chính", "Hạ tầng – IT"];
const favorites = ["Uniform_Request", "Transport_Allowance", "IM_Request"];

export default function NewCasePage() {
  return (
    <>
      <PageHeader title="Tạo hồ sơ mới" description="Chọn quy trình để bắt đầu. Chỉ hiển thị quy trình bạn được phép khởi tạo." />

      <input className={`${inputClass} mb-5 max-w-md`} placeholder="Tìm quy trình…" />

      <Card title="Thường dùng" className="mb-5">
        <div className="grid gap-3 sm:grid-cols-3">
          {processes
            .filter((p) => favorites.includes(p.key))
            .map((p) => (
              <button key={p.key} className="flex items-center gap-3 rounded-md border border-slate-200 p-3 text-left hover:border-blue-400 hover:bg-blue-50">
                <Star className="h-4 w-4 shrink-0 fill-amber-400 text-amber-400" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-slate-800">{p.name}</span>
                  <span className="block text-xs text-slate-500">{p.group}</span>
                </span>
                <ArrowRight className="h-4 w-4 text-slate-400" />
              </button>
            ))}
        </div>
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        {groups.map((g) => (
          <Card key={g} title={g}>
            <ul className="divide-y divide-slate-100">
              {processes
                .filter((p) => p.group === g)
                .map((p) => (
                  <li key={p.key} className="flex items-center gap-3 py-2.5">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-slate-800">{p.name}</span>
                      <span className="block text-xs text-slate-500">
                        {p.started12m.toLocaleString("vi-VN")} hồ sơ / 12 tháng · TB {p.avgDays} ngày
                      </span>
                    </span>
                    {p.migrated ? <Badge tone="blue">Hệ mới</Badge> : <Badge tone="violet">Đang ở hệ cũ</Badge>}
                    {p.key === "Process4MChange" ? (
                      <Link href="/4m/new" className="rounded-md border border-blue-400 bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100">
                        Tạo
                      </Link>
                    ) : (
                      <button className="rounded-md border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50">Tạo</button>
                    )}
                  </li>
                ))}
            </ul>
          </Card>
        ))}
      </div>

      <div className="mt-4">
        <WireNote>
          Quy trình “Đang ở hệ cũ” sẽ mở trang tạo của hệ cũ cho tới khi quy trình đó được chuyển (bước 3 của kế hoạch strangler). Khi chuyển xong, nút Tạo mở biểu mẫu trên hệ mới.
        </WireNote>
      </div>
    </>
  );
}
