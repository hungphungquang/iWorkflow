import { Tabs } from "@/components/tabs";
import { Badge, Card, PageHeader, WireNote, buttonClass, inputClass } from "@/components/ui";
import { departments } from "@/lib/mock";

const users = [
  { id: "an.nguyen", name: "Nguyễn An", dept: "151A · Hành chính", title: "Trưởng phòng", groups: "iw_manager", last: "03/11/2026" },
  { id: "mai.tran", name: "Trần Thị Mai", dept: "8511 · Sản xuất 1", title: "Nhân viên", groups: "iw_staff", last: "02/11/2026" },
  { id: "bao.pham", name: "Phạm Quốc Bảo", dept: "3212 · Kỹ thuật", title: "Kỹ sư", groups: "iw_staff", last: "28/10/2026" },
  { id: "hung.le", name: "Lê Văn Hùng", dept: "841A · QA", title: "Giám sát", groups: "iw_manager", last: "01/11/2026" },
];

const params = [
  { key: "PAGE_SIZE", value: "25", group: "Giao diện" },
  { key: "MAIL_FROM_ADDRESS", value: "btmv.app.mailbot@…", group: "Email" },
  { key: "MAIL_HOST_NAME", value: "10.80.6.24", group: "Email" },
  { key: "REMIND_EMAIL", value: "Bật", group: "Email" },
  { key: "LDAP_SERVER", value: "ldaps://VNDC0101…:636", group: "Kết nối" },
  { key: "LDAP_PASS", value: "(lưu trong secret store)", group: "Kết nối" },
];

function UsersTab() {
  return (
    <>
      <div className="mb-3 flex gap-2">
        <input className={`${inputClass} max-w-xs`} placeholder="Tìm người dùng…" />
        <button className={buttonClass()}>Đồng bộ từ AD</button>
      </div>
      <table className="w-full text-left text-sm">
        <thead className="border-b border-slate-200 text-xs uppercase text-slate-500">
          <tr>
            <th className="py-2 font-medium">Tài khoản</th>
            <th className="py-2 font-medium">Họ tên</th>
            <th className="py-2 font-medium">Đơn vị</th>
            <th className="py-2 font-medium">Chức vụ</th>
            <th className="py-2 font-medium">Nhóm quyền</th>
            <th className="py-2 font-medium">Đăng nhập gần nhất</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {users.map((u) => (
            <tr key={u.id}>
              <td className="py-2 font-mono text-xs">{u.id}</td>
              <td className="py-2">{u.name}</td>
              <td className="py-2 text-slate-600">{u.dept}</td>
              <td className="py-2 text-slate-600">{u.title}</td>
              <td className="py-2">
                <Badge>{u.groups}</Badge>
              </td>
              <td className="py-2 text-slate-600">{u.last}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

function DeptTab() {
  return (
    <ul className="space-y-1 text-sm">
      <li className="font-medium text-slate-800">BTMV – Công ty</li>
      {departments.map((d) => (
        <li key={d.code} className="ml-5 flex items-center gap-2 border-l border-slate-200 pl-3 text-slate-700">
          <span className="font-mono text-xs text-slate-500">{d.code}</span> {d.name}
          <span className="text-xs text-slate-400">· Trưởng BP, Người đại diện</span>
        </li>
      ))}
    </ul>
  );
}

function PermissionTab() {
  const menus = ["Tổng quan", "Hộp việc", "Tạo hồ sơ", "Tra cứu", "Báo cáo", "Quy trình", "Biểu mẫu", "Quản trị"];
  const roles = ["iw_staff", "iw_manager", "iw_gm", "iw_admin"];
  return (
    <table className="w-full text-sm">
      <thead className="border-b border-slate-200 text-xs uppercase text-slate-500">
        <tr>
          <th className="py-2 text-left font-medium">Chức năng</th>
          {roles.map((r) => (
            <th key={r} className="py-2 font-medium">
              {r}
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100">
        {menus.map((m, i) => (
          <tr key={m}>
            <td className="py-2">{m}</td>
            {roles.map((r, j) => (
              <td key={r} className="py-2 text-center">
                <input type="checkbox" defaultChecked={j >= Math.min(3, Math.floor(i / 2))} aria-label={`${m} – ${r}`} />
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function ParamsTab() {
  return (
    <table className="w-full text-left text-sm">
      <thead className="border-b border-slate-200 text-xs uppercase text-slate-500">
        <tr>
          <th className="py-2 font-medium">Nhóm</th>
          <th className="py-2 font-medium">Mã</th>
          <th className="py-2 font-medium">Giá trị</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100">
        {params.map((p) => (
          <tr key={p.key}>
            <td className="py-2 text-slate-600">{p.group}</td>
            <td className="py-2 font-mono text-xs">{p.key}</td>
            <td className="py-2">{p.value}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default function AdminPage() {
  return (
    <>
      <PageHeader title="Quản trị hệ thống" description="Người dùng, cơ cấu tổ chức, phân quyền, tham số và mẫu email" />
      <Card>
        <Tabs
          items={[
            { id: "users", label: "Người dùng", count: 588, content: <UsersTab /> },
            { id: "dept", label: "Đơn vị & chức vụ", content: <DeptTab /> },
            { id: "perm", label: "Phân quyền", content: <PermissionTab /> },
            { id: "params", label: "Tham số hệ thống", count: 59, content: <ParamsTab /> },
            { id: "mail", label: "Mẫu email", count: 7, content: <p className="text-sm text-slate-500">Trình soạn mẫu email (HTML) có biến &lt;&lt;TASK_NAME&gt;&gt;, &lt;&lt;PRO_NAME&gt;&gt;… và xem trước.</p> },
            { id: "audit", label: "Nhật ký thao tác", content: <p className="text-sm text-slate-500">Ai làm gì, lúc nào: phê duyệt, ký, sửa cấu hình, đăng nhập.</p> },
          ]}
        />
      </Card>
      <div className="mt-4">
        <WireNote>
          Không còn nút “xóa toàn bộ dữ liệu” (REMOVE_ALL_DATA). Mật khẩu kết nối không hiển thị/sửa trên màn hình, chỉ trong secret store. Mọi thay đổi cấu hình ghi nhật ký.
        </WireNote>
      </div>
    </>
  );
}
