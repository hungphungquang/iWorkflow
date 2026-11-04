import Link from "next/link";
import { Lock, ShieldCheck } from "lucide-react";
import { WireNote, inputClass } from "@/components/ui";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 p-4">
      <div className="w-full max-w-sm space-y-4">
        <div className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
          <div className="mb-6 flex flex-col items-center gap-2 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-600 text-lg font-bold text-white">iW</span>
            <h1 className="text-lg font-semibold text-slate-900">Đăng nhập iWorkflow</h1>
            <p className="text-xs text-slate-500">Dùng tài khoản Windows / AD của công ty</p>
          </div>
          <form className="space-y-3">
            <label className="block space-y-1">
              <span className="text-xs font-medium text-slate-600">Tên đăng nhập</span>
              <input className={inputClass} placeholder="vd. an.nguyen" autoComplete="username" />
            </label>
            <label className="block space-y-1">
              <span className="text-xs font-medium text-slate-600">Mật khẩu</span>
              <input className={inputClass} type="password" placeholder="••••••••" autoComplete="current-password" />
            </label>
            <Link href="/" className="flex w-full items-center justify-center gap-2 rounded-md bg-blue-600 py-2 text-sm font-medium text-white hover:bg-blue-700">
              <Lock className="h-4 w-4" aria-hidden /> Đăng nhập
            </Link>
          </form>
          <div className="my-4 flex items-center gap-3 text-[11px] text-slate-400">
            <span className="h-px flex-1 bg-slate-200" /> hoặc <span className="h-px flex-1 bg-slate-200" />
          </div>
          <button className="w-full rounded-md border border-slate-300 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Đăng nhập bằng Google Workspace</button>
          <p className="mt-6 flex items-center justify-center gap-1.5 text-[11px] text-slate-500">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" aria-hidden /> Kết nối được mã hóa HTTPS · mật khẩu không được lưu
          </p>
        </div>
        <WireNote>
          Xác thực qua LDAPS tới AD (như hệ cũ) nhưng toàn bộ trang chạy HTTPS. Khóa tạm thời sau 5 lần sai. Nút “Đăng nhập” trong wireframe chỉ chuyển sang trang Tổng quan.
        </WireNote>
      </div>
    </div>
  );
}
