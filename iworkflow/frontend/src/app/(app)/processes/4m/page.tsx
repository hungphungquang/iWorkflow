import Link from "next/link";
import { ArrowRight, CornerDownLeft, GitBranch, XCircle } from "lucide-react";
import { HBarChart } from "@/components/charts";
import { Badge, Card, LinkButton, PageHeader, StatCard, WireNote } from "@/components/ui";
import { stats, steps, type FourMStep } from "@/lib/fourm";

const definitions = [
  { key: "Process4MChange", name: "Before 4M Change", version: 12, role: "Quy trình chính: đề nghị → TP → GM → các phòng liên quan → gọi quy trình kết quả" },
  { key: "RelSecProc_2510", name: "Related Sections Approve Before 4M Change", version: 4, role: "Quy trình con cho từng phòng liên quan (TP tự duyệt hoặc phân công cán bộ)" },
  { key: "Process4MChangeResult", name: "After 4M Change", version: 13, role: "Nhập kết quả → TP → GM → các phòng liên quan xác nhận → người đề nghị xác nhận" },
  { key: "RelSecProcResult", name: "Related Sections Approve After 4M Change", version: 2, role: "Quy trình con xác nhận kết quả của từng phòng liên quan" },
  { key: "AntoanProc_2510", name: "Related Laws Assessment", version: 4, role: "Đánh giá luật an toàn (EHS) – không còn được gọi từ phiên bản hiện hành" },
];

const issues = [
  { sev: "red", title: "Người xử lý cố định trong BPMN", detail: "Tổng Giám đốc (2 bước) và người đánh giá luật an toàn được ghi cứng username. Đổi nhân sự là phải sửa và deploy lại quy trình.", fix: "Thay bằng vai trò cấu hình (GENERAL_DIRECTOR, EHS_LAW_REVIEWER) – giữ nguyên luồng." },
  { sev: "red", title: "Một phòng YCCS làm lại toàn bộ vòng thẩm định", detail: "Error end trong transaction hủy mọi phòng ban; sau khi sửa, tất cả phòng phải duyệt lại (TB 7,9 call activity/hồ sơ, tối đa 98).", fix: "Giai đoạn 1 giữ nguyên (G3). Hiển thị rõ phòng nào yêu cầu sửa và nội dung; đề xuất giai đoạn 2: chỉ hỏi lại phòng đã YCCS." },
  { sev: "amber", title: "SLA nhập kết quả 7 ngày không thực tế", detail: "Bước nhập kết quả có trung vị 33 ngày, 64% quá hạn – thực chất là thời gian triển khai thay đổi.", fix: "SLA tính theo ngày dự kiến áp dụng (P4MForm_ExpectedDate) + nhắc trước hạn." },
  { sev: "amber", title: "323/407 hồ sơ mở bị bỏ dở > 1 năm", detail: "Không có cơ chế nhắc/đóng; hồ sơ treo làm sai số liệu hộp việc và báo cáo.", fix: "Báo cáo tồn đọng 4M + nhắc tự động; đóng hàng loạt theo quyết định nghiệp vụ." },
  { sev: "amber", title: "Phê duyệt qua email dùng token yếu", detail: "CreateEmailPheDuyetTask sinh link duyệt cho TP và GM (bảo mật #6 trong tài liệu tổng quan).", fix: "EmailApprovalTokenDelegate: token ký HMAC, hết hạn, dùng 1 lần, ràng buộc assignee." },
  { sev: "gray", title: "Loại thay đổi (P4M_class) chỉ nằm trong XML biểu mẫu", detail: "Không phải biến quy trình nên không thống kê được bằng SQL thường.", fix: "Lưu cột có cấu trúc trong reporting.case_4m để dashboard lọc theo Q/S/C/D/E." },
  { sev: "gray", title: "Duyệt 2 lần bởi cùng một người", detail: "Đơn vị 8311 (63% đề nghị) có người đại diện = lãnh đạo → TP và GM là cùng một người (GM trung vị 3,4 giờ).", fix: "Tùy chọn tự động bỏ qua bước GM khi trùng người (cần nghiệp vụ duyệt)." },
] as const;

function StepBox({ step }: { step: FourMStep }) {
  return (
    <div className="w-44 shrink-0 rounded-md border border-slate-300 bg-white p-2 text-xs shadow-sm">
      <p className="font-medium text-slate-800">{step.nameVi}</p>
      <p className="mt-0.5 text-slate-500">{step.role}</p>
      <div className="mt-1 flex flex-wrap gap-1">
        {step.sla !== "—" && <Badge tone="amber">SLA {step.sla}</Badge>}
        {step.emailApproval && <Badge tone="violet">Duyệt qua email</Badge>}
      </div>
    </div>
  );
}

function Lane({ title, ids, tail }: { title: string; ids: string[]; tail: string }) {
  const laneSteps = ids.map((id) => steps.find((s) => s.id === id)!);
  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase text-slate-500">{title}</p>
      <div className="flex items-center gap-1.5 overflow-x-auto pb-2">
        {laneSteps.map((s) => (
          <div key={s.id} className="flex items-center gap-1.5">
            <StepBox step={s} />
            <ArrowRight className="h-4 w-4 shrink-0 text-slate-400" />
          </div>
        ))}
        <div className="shrink-0 rounded-full border border-emerald-400 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700">{tail}</div>
      </div>
    </div>
  );
}

export default function FourMProcessPage() {
  const started12m = 92;
  return (
    <>
      <Link href="/processes" className="mb-3 inline-flex text-xs text-slate-500 hover:text-slate-800">
        ‹ Quy trình
      </Link>
      <PageHeader
        title="Thay đổi 4M (4M Change)"
        description="Phân tích quy trình hiện tại trên iw_prod và cách triển khai trên hệ mới (Flowable). Luồng, biến và biểu mẫu giữ nguyên."
        actions={
          <>
            <LinkButton href="/processes/4m/simulate">Mô phỏng luồng</LinkButton>
            <LinkButton href="/4m/new" variant="primary">
              + Tạo yêu cầu 4M
            </LinkButton>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Hồ sơ mới 12 tháng" value={String(started12m)} hint="2019–2026: 786 hồ sơ" />
        <StatCard label="Đang mở" value={String(stats.open)} hint={`${stats.open - stats.abandoned} còn hoạt động trong 1 năm`} tone="amber" />
        <StatCard label="Bỏ dở > 1 năm" value={String(stats.abandoned)} hint="79% hồ sơ đang mở" tone="red" />
        <StatCard label="Phòng liên quan / hồ sơ" value="7,9" hint="kể cả các vòng làm lại (tối đa 98)" />
        <StatCard label="Tệp đính kèm" value={String(stats.attachments)} hint={`trên ${stats.casesWithAttachments} hồ sơ`} />
      </div>

      <Card title="Luồng nghiệp vụ (từ BPMN đang chạy trên prod)" className="mt-4">
        <div className="space-y-5">
          <Lane title="Giai đoạn 1 – Trước thay đổi (Process4MChange v12)" ids={["create", "mgr", "gm", "relsec"]} tail="→ Giai đoạn 2" />
          <Lane title="Giai đoạn 2 – Sau thay đổi (Process4MChangeResult v13)" ids={["result", "rmgr", "rgm", "rrelsec", "review"]} tail="Hoàn tất" />
          <div className="grid gap-3 text-xs md:grid-cols-3">
            <div className="rounded-md border border-slate-200 p-3">
              <p className="flex items-center gap-1.5 font-medium text-slate-800">
                <CornerDownLeft className="h-3.5 w-3.5 text-amber-600" /> Yêu cầu chỉnh sửa (YCCS)
              </p>
              <p className="mt-1 text-slate-600">TP/GM hoặc bất kỳ phòng liên quan nào chọn YCCS → hồ sơ quay về người đề nghị (giai đoạn 2: về bước nhập kết quả). Phòng liên quan YCCS sẽ dừng cả vòng thẩm định (error boundary).</p>
            </div>
            <div className="rounded-md border border-slate-200 p-3">
              <p className="flex items-center gap-1.5 font-medium text-slate-800">
                <XCircle className="h-3.5 w-3.5 text-red-600" /> Từ chối (TC)
              </p>
              <p className="mt-1 text-slate-600">TP/GM từ chối → gửi email từ chối, kết thúc. Phòng liên quan từ chối → cancel boundary → Tổng Giám đốc chọn Tiếp tục (làm lại vòng thẩm định / nhập lại kết quả) hoặc Kết thúc.</p>
            </div>
            <div className="rounded-md border border-slate-200 p-3">
              <p className="flex items-center gap-1.5 font-medium text-slate-800">
                <GitBranch className="h-3.5 w-3.5 text-blue-600" /> Phòng liên quan (song song)
              </p>
              <p className="mt-1 text-slate-600">Mỗi dòng của bảng P4M_PBXL_BMC sinh 1 quy trình con. Trưởng phòng tự duyệt hoặc phân công n cán bộ kiểm tra song song, sau đó duyệt lại (có thể phân công tiếp).</p>
            </div>
          </div>
        </div>
      </Card>

      <Card title="Các bước – người xử lý, biểu mẫu, SLA" className="mt-4">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-200 uppercase text-slate-500">
              <tr>
                <th className="px-2 py-2 font-medium">Bước</th>
                <th className="px-2 py-2 font-medium">Người xử lý (biểu thức BPMN)</th>
                <th className="px-2 py-2 font-medium">Biểu mẫu (form key)</th>
                <th className="px-2 py-2 font-medium">SLA</th>
                <th className="px-2 py-2 font-medium">Quyết định</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {steps.map((s) => (
                <tr key={s.id}>
                  <td className="px-2 py-2">
                    <p className="font-medium text-slate-800">{s.nameVi}</p>
                    <p className="font-mono text-[10px] text-slate-400">
                      {s.processKey} · {s.elementId}
                    </p>
                  </td>
                  <td className="px-2 py-2 text-slate-600">
                    {s.role}
                    <p className="font-mono text-[10px] text-slate-400">{s.assigneeExpr}</p>
                  </td>
                  <td className="px-2 py-2 font-mono text-[11px] text-slate-600">{s.formKey}</td>
                  <td className="whitespace-nowrap px-2 py-2 text-slate-600">{s.sla}</td>
                  <td className="px-2 py-2">
                    <div className="flex flex-wrap gap-1">
                      {s.decisions ? s.decisions.map((d) => <Badge key={d.value} tone={d.tone === "danger" ? "red" : d.tone === "primary" ? "green" : "amber"}>{d.label}</Badge>) : <Badge>Gửi / Xác nhận</Badge>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <Card title="Thời gian xử lý thực tế (giờ) – hồ sơ đã xử lý">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 uppercase text-slate-500">
                <tr>
                  <th className="px-2 py-2 font-medium">Bước</th>
                  <th className="px-2 py-2 text-right font-medium">Lượt</th>
                  <th className="px-2 py-2 text-right font-medium">Trung vị</th>
                  <th className="px-2 py-2 text-right font-medium">P90</th>
                  <th className="px-2 py-2 text-right font-medium">Trễ SLA</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {stats.stepDurations.map((d) => (
                  <tr key={d.step}>
                    <td className="px-2 py-1.5 text-slate-700">{d.step}</td>
                    <td className="px-2 py-1.5 text-right text-slate-600">{d.done.toLocaleString("vi-VN")}</td>
                    <td className="px-2 py-1.5 text-right text-slate-600">{d.medianH.toLocaleString("vi-VN")}</td>
                    <td className="px-2 py-1.5 text-right text-slate-600">{d.p90H.toLocaleString("vi-VN")}</td>
                    <td className="px-2 py-1.5 text-right">
                      {d.latePct === null ? "—" : <Badge tone={d.latePct >= 40 ? "red" : d.latePct >= 25 ? "amber" : "green"}>{d.latePct.toLocaleString("vi-VN")}%</Badge>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
        <div className="space-y-4">
          <Card title="Số hồ sơ khởi tạo theo năm">
            <HBarChart data={stats.startedByYear} />
          </Card>
          <Card title="Quyết định của phòng liên quan (giai đoạn 1)">
            <HBarChart data={stats.decisionsRelated} />
            <p className="mt-2 text-xs text-slate-500">TP/GM đơn vị đề nghị: 376 phê duyệt, 43 YCCS, 0 từ chối. Tổng Giám đốc: 3 lần “Tiếp tục”.</p>
          </Card>
        </div>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <Card title="Đơn vị đề nghị">
          <HBarChart data={stats.requesterSections} />
        </Card>
        <Card title="Phòng liên quan được hỏi nhiều nhất">
          <HBarChart data={stats.topRelatedSections} />
        </Card>
        <Card title="Loại thay đổi (179 hồ sơ, chọn nhiều)">
          <HBarChart data={stats.classMix} />
        </Card>
      </div>

      <Card title="Vấn đề phát hiện & cách xử lý trên hệ mới" className="mt-4">
        <ul className="divide-y divide-slate-100">
          {issues.map((i) => (
            <li key={i.title} className="grid gap-2 py-3 text-sm md:grid-cols-[1.2fr_1.5fr_1.5fr]">
              <span className="flex items-start gap-2 font-medium text-slate-800">
                <Badge tone={i.sev}>{i.sev === "red" ? "Cao" : i.sev === "amber" ? "Trung bình" : "Thấp"}</Badge>
                {i.title}
              </span>
              <span className="text-slate-600">{i.detail}</span>
              <span className="text-slate-700">→ {i.fix}</span>
            </li>
          ))}
        </ul>
      </Card>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <Card title="Định nghĩa quy trình (5 BPMN)">
          <ul className="space-y-2 text-sm">
            {definitions.map((d) => (
              <li key={d.key} className="flex items-start gap-2">
                <Badge tone="blue">v{d.version}</Badge>
                <span className="min-w-0">
                  <span className="font-mono text-xs text-slate-800">{d.key}</span> <span className="text-slate-500">– {d.name}</span>
                  <span className="block text-xs text-slate-500">{d.role}</span>
                </span>
              </li>
            ))}
          </ul>
        </Card>
        <Card title="Triển khai trên hệ mới">
          <ul className="list-disc space-y-1.5 pl-5 text-sm text-slate-700">
            <li>5 BPMN đã chuyển sang Flowable (giữ nguyên id phần tử, biến, form key) – thư mục <span className="font-mono text-xs">iworkflow/workflows/4m</span>.</li>
            <li>7 lớp com.eform.* được thay bằng delegate mới trong gói <span className="font-mono text-xs">vn.btmv.iworkflow.workflow.delegate</span>.</li>
            <li>Hồ sơ mới tạo trên hệ mới; hồ sơ cũ tiếp tục ở hệ cũ (drain). 84 hồ sơ còn hoạt động được chuyển tại điểm ranh giới giai đoạn nếu kéo dài.</li>
            <li>Dashboard 4M: tồn đọng theo bước/phòng, trễ SLA, phân loại Q/S/C/D/E – từ schema reporting.</li>
          </ul>
        </Card>
      </div>

      <div className="mt-4">
        <WireNote>
          Số liệu lấy từ iw_prod (03/11/2026), chỉ đọc. Tên người trong màn hình mô phỏng là vai trò giả lập; hệ thật lấy từ HT_DONVI (người đại diện / lãnh đạo đại diện). Chi tiết: docs/process-4m-analysis.md.
        </WireNote>
      </div>
    </>
  );
}
