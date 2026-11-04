// Mock data for the wireframe. Process keys, names and volumes mirror the iw_prod survey (03/11/2026); people are fictional.

export type ProcessGroup = "Sản xuất & Chất lượng" | "Hành chính – Nhân sự" | "Mua hàng – Tài chính" | "Hạ tầng – IT";

export type ProcessDef = {
  key: string;
  name: string;
  group: ProcessGroup;
  version: number;
  started12m: number;
  finished12m: number;
  avgDays: number;
  open: number;
  migrated: boolean;
};

export const processes: ProcessDef[] = [
  { key: "RelSecWS", name: "Related Sections approve Working Standard", group: "Sản xuất & Chất lượng", version: 12, started12m: 2246, finished12m: 2235, avgDays: 3.6, open: 11, migrated: false },
  { key: "Operational_Request_Form", name: "Operational Request Form", group: "Hành chính – Nhân sự", version: 3, started12m: 1052, finished12m: 540, avgDays: 11.3, open: 3220, migrated: false },
  { key: "WS_assessment", name: "Work Standard Deliberation", group: "Sản xuất & Chất lượng", version: 33, started12m: 935, finished12m: 859, avgDays: 16.2, open: 140, migrated: false },
  { key: "Uniform_Request", name: "Request Providing Company Uniform", group: "Hành chính – Nhân sự", version: 11, started12m: 865, finished12m: 191, avgDays: 14.4, open: 2220, migrated: true },
  { key: "RelSecProc_2510", name: "Related Sections Approve Before 4M Change", group: "Sản xuất & Chất lượng", version: 4, started12m: 487, finished12m: 453, avgDays: 9.8, open: 85, migrated: false },
  { key: "IM_Request", name: "Infrastructure service request", group: "Hạ tầng – IT", version: 7, started12m: 241, finished12m: 65, avgDays: 23.4, open: 166, migrated: false },
  { key: "RelSecProc_Document", name: "Related Sections Deliberation Document", group: "Sản xuất & Chất lượng", version: 1, started12m: 166, finished12m: 155, avgDays: 12.1, open: 9, migrated: false },
  { key: "SanctionProcess", name: "SanctionSheet Online", group: "Mua hàng – Tài chính", version: 17, started12m: 162, finished12m: 32, avgDays: 7.0, open: 392, migrated: false },
  { key: "QCCD_SV_Activity", name: "QCCD SV Activity", group: "Sản xuất & Chất lượng", version: 3, started12m: 162, finished12m: 105, avgDays: 20.8, open: 86, migrated: false },
  { key: "Abnormal_Mixed_Compound", name: "Notification and Decision for Abnormal Mixed Compound", group: "Sản xuất & Chất lượng", version: 4, started12m: 95, finished12m: 78, avgDays: 33.8, open: 29, migrated: false },
  { key: "Process4MChange", name: "Before 4M Change", group: "Sản xuất & Chất lượng", version: 12, started12m: 92, finished12m: 13, avgDays: 52.4, open: 398, migrated: false },
  { key: "VMEC_Kaizen", name: "VMEC Improvement request", group: "Sản xuất & Chất lượng", version: 12, started12m: 90, finished12m: 8, avgDays: 13.4, open: 327, migrated: false },
  { key: "Transport_Allowance", name: "Transportation allowance Application", group: "Hành chính – Nhân sự", version: 7, started12m: 77, finished12m: 61, avgDays: 9.9, open: 22, migrated: true },
  { key: "Laptop_Takeout", name: "Take-out Laptop / Important Information", group: "Hạ tầng – IT", version: 8, started12m: 57, finished12m: 11, avgDays: 18.4, open: 167, migrated: false },
  { key: "PR_approval", name: "Purchase Request Approval", group: "Mua hàng – Tài chính", version: 8, started12m: 0, finished12m: 0, avgDays: 0, open: 0, migrated: false },
  { key: "Commuting_Request", name: "Commuting Application Approval Form", group: "Hành chính – Nhân sự", version: 7, started12m: 31, finished12m: 24, avgDays: 11.3, open: 7, migrated: false },
];

export type TaskStatus = "overdue" | "dueSoon" | "normal";
export type TaskSource = "new" | "legacy";

export type Task = {
  id: string;
  code: string;
  title: string;
  processKey: string;
  step: string;
  requester: string;
  assignee: string;
  created: string;
  due: string;
  status: TaskStatus;
  source: TaskSource;
};

export const tasks: Task[] = [
  { id: "t-1001", code: "GA-2026-1158", title: "Cấp đồng phục mùa đông – Tổ sơ chế", processKey: "Uniform_Request", step: "Manager Approve Uniform Request", requester: "Trần Thị Mai", assignee: "Bạn", created: "2026-10-28", due: "2026-11-04", status: "dueSoon", source: "new" },
  { id: "t-1002", code: "QA-2026-072", title: "Hợp chất trộn bất thường – lô 26K-118", processKey: "Abnormal_Mixed_Compound", step: "8511 approve Notification and Decision", requester: "Lê Văn Hùng", assignee: "Bạn", created: "2026-10-30", due: "2026-11-02", status: "overdue", source: "legacy" },
  { id: "t-1003", code: "ENG-2026-341", title: "Thay đổi 4M – máy cán số 3", processKey: "Process4MChange", step: "Check 4M Change request", requester: "Phạm Quốc Bảo", assignee: "Bạn", created: "2026-10-21", due: "2026-11-10", status: "normal", source: "legacy" },
  { id: "t-1004", code: "GA-2026-1162", title: "Phụ cấp đi lại – Tháng 11", processKey: "Transport_Allowance", step: "Manager Approve Transportation allowance", requester: "Đỗ Thu Hà", assignee: "Bạn", created: "2026-11-01", due: "2026-11-06", status: "normal", source: "new" },
  { id: "t-1005", code: "WS-2026-889", title: "Thẩm định tiêu chuẩn công việc – Line B", processKey: "WS_assessment", step: "Supervisor Ca B đánh giá", requester: "Ngô Minh Tuấn", assignee: "Bạn", created: "2026-10-15", due: "2026-10-31", status: "overdue", source: "legacy" },
  { id: "t-1006", code: "IT-2026-058", title: "Yêu cầu mở rộng mạng xưởng 2", processKey: "IM_Request", step: "800 approve Infrastructure service request", requester: "Vũ Thị Lan", assignee: "Nhóm IT Manager", created: "2026-10-29", due: "2026-11-12", status: "normal", source: "legacy" },
  { id: "t-1007", code: "FI-2026-652", title: "Yêu cầu vận hành – sửa mái kho", processKey: "Operational_Request_Form", step: "Phê duyệt yêu cầu xử lý", requester: "Hoàng Văn Nam", assignee: "Nhóm GA Manager", created: "2026-11-02", due: "2026-11-09", status: "normal", source: "legacy" },
  { id: "t-1008", code: "GA-2026-1170", title: "Cấp đồng phục nhân viên mới (12 người)", processKey: "Uniform_Request", step: "GA Staff Check Uniform Request", requester: "Bùi Thanh Tâm", assignee: "Nhóm GA Staff", created: "2026-11-03", due: "2026-11-08", status: "normal", source: "new" },
];

export const legacyDrain = {
  openTotal: 8318,
  touched90d: 759,
  abandoned: 5795,
  categories: [
    { code: "A", label: "Nháp chưa gửi", count: 1128, action: "Hủy" },
    { code: "B", label: "Chờ xác nhận cuối", count: 3874, action: "Đóng hoàn tất" },
    { code: "C", label: "Trạng thái lỗi", count: 34, action: "Kỹ thuật kiểm tra" },
    { code: "D", label: "Dừng giữa quy trình", count: 512, action: "Trưởng BP quyết định" },
  ],
};

export const monthlyTrend = [
  { m: "12/25", started: 498, finished: 431 },
  { m: "01/26", started: 512, finished: 455 },
  { m: "02/26", started: 365, finished: 340 },
  { m: "03/26", started: 588, finished: 520 },
  { m: "04/26", started: 602, finished: 547 },
  { m: "05/26", started: 571, finished: 530 },
  { m: "06/26", started: 549, finished: 498 },
  { m: "07/26", started: 618, finished: 560 },
  { m: "08/26", started: 590, finished: 541 },
  { m: "09/26", started: 633, finished: 575 },
  { m: "10/26", started: 655, finished: 602 },
  { m: "11/26", started: 81, finished: 64 },
];

export const departments = [
  { code: "8511", name: "Sản xuất 1", sla: 92 },
  { code: "8512", name: "Sản xuất 2", sla: 88 },
  { code: "3212", name: "Kỹ thuật", sla: 81 },
  { code: "841A", name: "Chất lượng (QA)", sla: 95 },
  { code: "151A", name: "Hành chính (GA)", sla: 76 },
  { code: "800", name: "Ban Giám đốc", sla: 70 },
];

export function processByKey(key: string) {
  return processes.find((p) => p.key === key);
}

export function taskById(id: string) {
  return tasks.find((t) => t.id === id);
}
