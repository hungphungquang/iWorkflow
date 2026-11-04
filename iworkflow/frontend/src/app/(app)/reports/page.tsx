import { GripVertical, Plus } from "lucide-react";
import { ColumnChart, Donut, HBarChart } from "@/components/charts";
import { Badge, Card, Field, PageHeader, WireNote, buttonClass, inputClass } from "@/components/ui";
import { departments, monthlyTrend, processes } from "@/lib/mock";

const dashboards = [
  { name: "Tổng quan toàn công ty", owner: "Ban Giám đốc", widgets: 8, shared: true },
  { name: "SLA phê duyệt theo bộ phận", owner: "GA", widgets: 4, shared: true },
  { name: "Theo dõi 4M Change", owner: "QA", widgets: 5, shared: false },
];

const views = [
  "reporting.v_case_by_process_month",
  "reporting.v_task_duration_by_step",
  "reporting.v_sla_by_department",
  "reporting.v_overdue_tasks",
  "reporting.v_workload_by_assignee",
];

export default function ReportsPage() {
  const byGroup = Object.entries(
    processes.reduce<Record<string, number>>((acc, p) => ({ ...acc, [p.group]: (acc[p.group] ?? 0) + p.started12m }), {}),
  );
  const colors = ["#3b82f6", "#10b981", "#f59e0b", "#8b5cf6"];

  return (
    <>
      <PageHeader
        title="Báo cáo & Dashboard"
        description="Chọn dashboard có sẵn hoặc tự tạo bằng cách thêm widget từ các nguồn dữ liệu đã đăng ký"
        actions={
          <>
            <button className={buttonClass()}>Xuất Excel</button>
            <button className={buttonClass("primary")}>
              <Plus className="h-4 w-4" /> Dashboard mới
            </button>
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[16rem_1fr]">
        <Card title="Dashboard của tôi">
          <ul className="space-y-1">
            {dashboards.map((d, i) => (
              <li key={d.name} className={`rounded-md px-2 py-2 text-sm ${i === 0 ? "bg-blue-50 text-blue-800" : "text-slate-700 hover:bg-slate-50"}`}>
                <p className="font-medium">{d.name}</p>
                <p className="text-xs text-slate-500">
                  {d.owner} · {d.widgets} widget {d.shared && "· chia sẻ"}
                </p>
              </li>
            ))}
          </ul>
        </Card>

        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <select className={`${inputClass} max-w-[12rem]`} defaultValue="12m">
              <option value="12m">12 tháng gần nhất</option>
              <option>Quý này</option>
              <option>Tháng này</option>
            </select>
            <select className={`${inputClass} max-w-[14rem]`} defaultValue="">
              <option value="">Tất cả bộ phận</option>
              {departments.map((d) => (
                <option key={d.code}>
                  {d.code} · {d.name}
                </option>
              ))}
            </select>
            <span className="ml-auto text-xs text-slate-500">Cập nhật lúc 08:00 · làm mới mỗi giờ</span>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <Card title="Hồ sơ theo nhóm quy trình" actions={<GripVertical className="h-4 w-4 text-slate-300" />}>
              <Donut segments={byGroup.map(([label, value], i) => ({ label, value, color: colors[i % colors.length] }))} />
            </Card>
            <Card title="Thời gian xử lý trung bình (ngày)" actions={<GripVertical className="h-4 w-4 text-slate-300" />}>
              <HBarChart
                data={[...processes]
                  .filter((p) => p.avgDays > 0)
                  .sort((a, b) => b.avgDays - a.avgDays)
                  .slice(0, 7)
                  .map((p) => ({ label: p.name, value: p.avgDays }))}
              />
            </Card>
            <Card title="Xu hướng tạo mới / hoàn tất" className="xl:col-span-2" actions={<GripVertical className="h-4 w-4 text-slate-300" />}>
              <ColumnChart data={monthlyTrend.map((x) => ({ label: x.m, value: x.started, secondary: x.finished }))} primaryLabel="Tạo mới" secondaryLabel="Hoàn tất" />
            </Card>
          </div>

          <Card title="Thêm widget" actions={<Badge tone="amber">Chỉ admin báo cáo</Badge>}>
            <div className="grid gap-4 md:grid-cols-4">
              <Field label="Nguồn dữ liệu (view đã đăng ký)" span={2}>
                <select className={inputClass} defaultValue={views[0]}>
                  {views.map((v) => (
                    <option key={v}>{v}</option>
                  ))}
                </select>
              </Field>
              <Field label="Loại biểu đồ">
                <select className={inputClass} defaultValue="bar">
                  <option value="bar">Cột</option>
                  <option>Thanh ngang</option>
                  <option>Đường</option>
                  <option>Tròn</option>
                  <option>Bảng</option>
                  <option>Chỉ số (KPI)</option>
                </select>
              </Field>
              <Field label="Quyền xem">
                <select className={inputClass} defaultValue="">
                  <option value="">Theo đơn vị người xem</option>
                  <option>Toàn công ty</option>
                </select>
              </Field>
              <Field label="Chiều (nhóm theo)">
                <select className={inputClass}>
                  <option>Tháng</option>
                  <option>Quy trình</option>
                  <option>Bộ phận</option>
                </select>
              </Field>
              <Field label="Chỉ số">
                <select className={inputClass}>
                  <option>Số hồ sơ</option>
                  <option>Thời gian TB</option>
                  <option>% đúng hạn</option>
                </select>
              </Field>
              <Field label="Bộ lọc mặc định" span={2}>
                <input className={inputClass} placeholder="vd. quy trình = Uniform_Request" />
              </Field>
            </div>
            <div className="mt-4 flex gap-2">
              <button className={buttonClass("primary")}>Thêm vào dashboard</button>
              <button className={buttonClass("ghost")}>Xem trước</button>
            </div>
          </Card>

          <WireNote>
            Mục tiêu G1: thêm dashboard <b>không cần sửa code</b>. Dữ liệu chỉ lấy từ view trong schema <code>reporting</code> (đã kiểm soát quyền), không cho nhập SQL tự do. Biểu đồ thật dùng ECharts; có thể nhúng Superset/Metabase cho phân tích nâng cao.
          </WireNote>
        </div>
      </div>
    </>
  );
}
