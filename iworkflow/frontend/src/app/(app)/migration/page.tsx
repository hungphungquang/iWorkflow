import { Donut } from "@/components/charts";
import { Badge, Card, PageHeader, StatCard, WireNote, buttonClass } from "@/components/ui";
import { legacyDrain, processes } from "@/lib/mock";

const catColors = { A: "#94a3b8", B: "#10b981", C: "#ef4444", D: "#f59e0b" } as const;

export default function MigrationPage() {
  return (
    <>
      <PageHeader
        title="Chuyển đổi từ hệ cũ"
        description="Theo dõi chuyển từng quy trình sang hệ mới và xử lý hồ sơ tồn đọng trên Activiti 5"
        actions={<button className={buttonClass()}>Tải danh sách hồ sơ bỏ dở (CSV)</button>}
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Hồ sơ mở trên hệ cũ" value={legacyDrain.openTotal.toLocaleString("vi-VN")} />
        <StatCard label="Còn hoạt động (90 ngày)" value={legacyDrain.touched90d.toLocaleString("vi-VN")} tone="amber" />
        <StatCard label="Bỏ dở > 1 năm" value={legacyDrain.abandoned.toLocaleString("vi-VN")} tone="red" />
        <StatCard label="Quy trình đã chuyển" value={`${processes.filter((p) => p.migrated).length} / 29`} tone="green" />
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-2">
        <Card title="Hồ sơ bỏ dở > 1 năm theo nhóm xử lý">
          <Donut segments={legacyDrain.categories.map((c) => ({ label: `${c.code}. ${c.label} → ${c.action}`, value: c.count, color: catColors[c.code as keyof typeof catColors] }))} />
          <div className="mt-4 flex gap-2">
            <button className={buttonClass()}>Gửi danh sách cho chủ quy trình</button>
            <button className={buttonClass("danger")} disabled>
              Đóng hàng loạt (chờ phê duyệt)
            </button>
          </div>
        </Card>

        <Card title="Tiến độ chuyển quy trình">
          <ul className="divide-y divide-slate-100">
            {processes.slice(0, 10).map((p) => (
              <li key={p.key} className="flex items-center gap-3 py-2 text-sm">
                <span className="min-w-0 flex-1 truncate">{p.name}</span>
                <span className="w-24 text-right text-xs text-slate-500">{p.open.toLocaleString("vi-VN")} mở (cũ)</span>
                {p.migrated ? <Badge tone="green">Đã chuyển</Badge> : <Badge>Chưa chuyển</Badge>}
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <div className="mt-4">
        <WireNote>
          Màn hình dành cho admin dự án trong giai đoạn chạy song song. Số liệu lấy từ khảo sát prod 03/11/2026 (xem docs/abandoned-instances-report.md). Nút đóng hàng loạt chỉ bật sau khi chính sách được duyệt.
        </WireNote>
      </div>
    </>
  );
}
