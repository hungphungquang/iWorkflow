"use client";

import { useState } from "react";
import { CheckCircle2, CornerUpLeft, XCircle } from "lucide-react";
import { buttonClass } from "@/components/ui";

const actions = [
  { id: "approve", label: "Phê duyệt", icon: CheckCircle2, variant: "primary" as const, needsComment: false },
  { id: "return", label: "Yêu cầu chỉnh sửa", icon: CornerUpLeft, variant: "secondary" as const, needsComment: true },
  { id: "reject", label: "Từ chối", icon: XCircle, variant: "danger" as const, needsComment: true },
];

export function TaskActions() {
  const [comment, setComment] = useState("");
  const [done, setDone] = useState<string | null>(null);

  if (done) {
    return (
      <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
        Đã ghi nhận: <b>{done}</b>. Hồ sơ chuyển sang bước tiếp theo, email thông báo được gửi tới người xử lý kế tiếp. (mô phỏng)
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        rows={2}
        placeholder="Ý kiến xử lý (bắt buộc khi Yêu cầu chỉnh sửa / Từ chối)"
        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
      />
      <div className="flex flex-wrap gap-2">
        {actions.map(({ id, label, icon: Icon, variant, needsComment }) => (
          <button
            key={id}
            className={`${buttonClass(variant)} disabled:cursor-not-allowed disabled:opacity-50`}
            disabled={needsComment && comment.trim() === ""}
            onClick={() => setDone(label)}
          >
            <Icon className="h-4 w-4" /> {label}
          </button>
        ))}
        <button className={buttonClass("ghost")}>Lưu nháp</button>
        <button className={buttonClass("ghost")}>Ủy quyền…</button>
      </div>
    </div>
  );
}
