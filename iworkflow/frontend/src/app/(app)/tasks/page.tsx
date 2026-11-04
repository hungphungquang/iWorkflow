import Link from "next/link";
import { Filter } from "lucide-react";
import { Tabs } from "@/components/tabs";
import { Card, PageHeader, SourceBadge, StatusBadge, WireNote, buttonClass, inputClass } from "@/components/ui";
import { processByKey, processes, tasks, type Task } from "@/lib/mock";

function TaskTable({ rows }: { rows: Task[] }) {
  if (rows.length === 0) return <p className="py-10 text-center text-sm text-slate-500">Không có công việc.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-slate-200 text-xs uppercase text-slate-500">
          <tr>
            <th className="px-3 py-2 font-medium">Mã hồ sơ</th>
            <th className="px-3 py-2 font-medium">Tiêu đề / Quy trình</th>
            <th className="px-3 py-2 font-medium">Bước hiện tại</th>
            <th className="px-3 py-2 font-medium">Người tạo</th>
            <th className="px-3 py-2 font-medium">Hạn xử lý</th>
            <th className="px-3 py-2 font-medium">Trạng thái</th>
            <th className="px-3 py-2 font-medium">Nguồn</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((t) => (
            <tr key={t.id} className="hover:bg-slate-50">
              <td className="px-3 py-2.5 font-mono text-xs">
                <Link href={`/tasks/${t.id}`} className="text-blue-700 hover:underline">
                  {t.code}
                </Link>
              </td>
              <td className="max-w-xs px-3 py-2.5">
                <Link href={`/tasks/${t.id}`} className="block truncate font-medium text-slate-800 hover:underline">
                  {t.title}
                </Link>
                <span className="block truncate text-xs text-slate-500">{processByKey(t.processKey)?.name}</span>
              </td>
              <td className="max-w-[14rem] truncate px-3 py-2.5 text-slate-600">{t.step}</td>
              <td className="whitespace-nowrap px-3 py-2.5 text-slate-600">{t.requester}</td>
              <td className="whitespace-nowrap px-3 py-2.5 text-slate-600">{t.due.split("-").reverse().join("/")}</td>
              <td className="px-3 py-2.5">
                <StatusBadge status={t.status} />
              </td>
              <td className="px-3 py-2.5">
                <SourceBadge source={t.source} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function TasksPage() {
  const mine = tasks.filter((t) => t.assignee === "Bạn");
  const queue = tasks.filter((t) => t.assignee.startsWith("Nhóm"));

  return (
    <>
      <PageHeader title="Hộp việc" description="Tất cả công việc của bạn từ cả hệ mới và hệ cũ (trong thời gian chuyển đổi)" />

      <Card>
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <input className={`${inputClass} max-w-xs`} placeholder="Tìm theo mã, tiêu đề…" />
          <select className={`${inputClass} max-w-[16rem]`} defaultValue="">
            <option value="">Tất cả quy trình</option>
            {processes.map((p) => (
              <option key={p.key} value={p.key}>
                {p.name}
              </option>
            ))}
          </select>
          <select className={`${inputClass} max-w-[10rem]`} defaultValue="">
            <option value="">Mọi trạng thái</option>
            <option>Quá hạn</option>
            <option>Sắp đến hạn</option>
            <option>Trong hạn</option>
          </select>
          <button className={buttonClass()}>
            <Filter className="h-4 w-4" /> Lọc nâng cao
          </button>
        </div>

        <Tabs
          items={[
            { id: "mine", label: "Việc của tôi", count: mine.length, content: <TaskTable rows={mine} /> },
            { id: "queue", label: "Việc của nhóm (chờ nhận)", count: queue.length, content: <TaskTable rows={queue} /> },
            { id: "involved", label: "Tôi liên quan", count: 3, content: <TaskTable rows={tasks.slice(5, 8)} /> },
            { id: "done", label: "Đã xử lý", content: <TaskTable rows={[]} /> },
            { id: "created", label: "Hồ sơ tôi tạo", count: 2, content: <TaskTable rows={tasks.slice(3, 5)} /> },
          ]}
        />
      </Card>

      <div className="mt-4">
        <WireNote>
          Hộp việc <b>hợp nhất</b>: công việc trên Flowable (Hệ mới) và Activiti 5 (Hệ cũ, nhãn tím) hiển thị chung. Mở việc Hệ cũ sẽ hiển thị đọc được trên giao diện mới; thao tác xử lý chuyển về hệ cũ cho tới khi drain xong. Việc của nhóm cần bấm “Nhận việc” trước khi xử lý (giống “queue” của hệ cũ).
        </WireNote>
      </div>
    </>
  );
}
