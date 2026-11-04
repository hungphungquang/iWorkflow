import { Badge, Card, PageHeader, WireNote, buttonClass, inputClass } from "@/components/ui";

const forms = [
  { code: "Uniform_Request", name: "Request Providing Company Uniform", fields: 48, active: true },
  { code: "Uniform_Request_Read", name: "Uniform Request (chỉ đọc)", fields: 48, active: true },
  { code: "ORF_RequestForm", name: "Operational Request Form", fields: 25, active: true },
  { code: "P4MForm_Request_BTMV", name: "4M Form Request BTMV", fields: 9, active: true },
  { code: "Sanction_Request", name: "Sanction Request", fields: 12, active: true },
  { code: "WS_Request", name: "WS Request", fields: 23, active: false },
];

const fieldTypes = ["Văn bản", "Văn bản dài", "Số", "Ngày", "Danh mục (dropdown)", "Người dùng", "Đơn vị", "Tệp đính kèm", "Bảng con (sub-form)", "Công thức", "Chữ ký"];

const layout = [
  [{ label: "Bộ phận yêu cầu", type: "Đơn vị", span: 2 }, { label: "Ngày cần", type: "Ngày", span: 1 }, { label: "Loại yêu cầu", type: "Danh mục", span: 1 }],
  [{ label: "Lý do", type: "Văn bản dài", span: 4 }],
  [{ label: "Danh sách vật phẩm", type: "Bảng con · Uniform_Item_Sub", span: 4 }],
  [{ label: "Tổng số lượng", type: "Công thức = SUM(qty)", span: 1 }, { label: "Ghi chú GA", type: "Văn bản", span: 3 }],
];

export default function FormsPage() {
  return (
    <>
      <PageHeader title="Biểu mẫu" description="Thiết kế biểu mẫu động dạng lưới – dùng lại cấu hình BIEU_MAU / TRUONG_THONG_TIN hiện có" actions={<button className={buttonClass("primary")}>+ Biểu mẫu mới</button>} />
      <div className="grid gap-4 xl:grid-cols-[18rem_1fr_14rem]">
        <Card title="Danh sách (161 đang dùng)">
          <input className={`${inputClass} mb-3`} placeholder="Tìm mã / tên…" />
          <ul className="space-y-1">
            {forms.map((f, i) => (
              <li key={f.code} className={`rounded-md px-2 py-1.5 ${i === 0 ? "bg-blue-50" : "hover:bg-slate-50"}`}>
                <p className="truncate text-sm font-medium text-slate-800">{f.name}</p>
                <p className="flex items-center gap-2 font-mono text-[11px] text-slate-500">
                  {f.code} · {f.fields} trường {!f.active && <Badge>ngưng</Badge>}
                </p>
              </li>
            ))}
          </ul>
        </Card>

        <Card
          title="Uniform_Request · bố cục"
          actions={
            <div className="flex gap-2">
              <button className={buttonClass("ghost")}>Xem trước</button>
              <button className={buttonClass("primary")}>Lưu</button>
            </div>
          }
        >
          <div className="space-y-2">
            {layout.map((row, r) => (
              <div key={r} className="grid grid-cols-4 gap-2">
                {row.map((cell) => (
                  <div
                    key={cell.label}
                    className="rounded-md border border-dashed border-slate-300 bg-slate-50 p-2 hover:border-blue-400"
                    style={{ gridColumn: `span ${cell.span} / span ${cell.span}` }}
                  >
                    <p className="text-xs font-medium text-slate-700">{cell.label}</p>
                    <p className="text-[11px] text-slate-500">{cell.type}</p>
                  </div>
                ))}
              </div>
            ))}
            <button className="w-full rounded-md border-2 border-dashed border-slate-200 py-2 text-xs text-slate-500 hover:border-blue-300 hover:text-blue-600">+ Thêm hàng</button>
          </div>
        </Card>

        <Card title="Loại trường">
          <ul className="space-y-1">
            {fieldTypes.map((t) => (
              <li key={t} className="cursor-grab rounded border border-slate-200 bg-white px-2 py-1 text-xs text-slate-600 hover:border-blue-300">
                {t}
              </li>
            ))}
          </ul>
        </Card>
      </div>
      <div className="mt-4">
        <WireNote>
          Giữ nguyên mô hình lưới hàng/ô của hệ cũ để 161 biểu mẫu đang dùng hiển thị được ngay không cần làm lại. Biểu mẫu chỉ đọc (<code>*_Read</code>) và biểu mẫu theo bước có thể sinh tự động từ một biểu mẫu gốc + quyền theo bước (giảm số bản copy).
        </WireNote>
      </div>
    </>
  );
}
