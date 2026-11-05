"use client";

import { useEffect } from "react";
import { Database, Loader2, RotateCcw } from "lucide-react";
import { fmtDateTime, useLocale } from "@/lib/i18n";
import { loadProdSnapshot, READ_ONLY, useProdStatus } from "@/lib/store";

/** In iw_prod read-only mode: loads the snapshot once and holds the page until the real data is in. */
export function ProdDataGate({ children }: { children: React.ReactNode }) {
  const status = useProdStatus();
  const locale = useLocale();

  useEffect(() => {
    void loadProdSnapshot();
  }, []);

  if (!READ_ONLY) return <>{children}</>;

  const banner = (
    <div className="mb-4 flex flex-wrap items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs text-amber-900" role="status">
      <Database className="h-3.5 w-3.5" aria-hidden />
      <span>
        <b>Dữ liệu thật iw_prod · chỉ đọc.</b> Thao tác xử lý vẫn thực hiện trên iWorkflow hiện tại.
      </span>
      {status.state === "ready" && (
        <span className="text-amber-700">
          {status.count} hồ sơ · nạp lúc {fmtDateTime(status.loadedAt ?? "", locale)}
        </span>
      )}
      <button
        type="button"
        disabled={status.state === "loading"}
        onClick={() => void loadProdSnapshot(true)}
        className="ml-auto inline-flex items-center gap-1 rounded border border-amber-300 bg-white px-2 py-0.5 hover:bg-amber-100 disabled:opacity-50"
      >
        {status.state === "loading" ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCcw className="h-3 w-3" />} Tải lại
      </button>
    </div>
  );

  // Children stay mounted (hidden) while loading so the route segment is always rendered.
  return (
    <>
      {banner}
      {status.state === "error" ? (
        <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <p className="font-semibold">Không nạp được dữ liệu từ iw_prod</p>
          <p className="mt-1 font-mono text-xs">{status.error}</p>
          <p className="mt-2 text-xs">Kiểm tra kết nối VPN/LAN tới máy chủ CSDL và mật khẩu trong pgpass.conf hoặc IW_DB_PASSWORD.</p>
        </div>
      ) : (
        status.state !== "ready" && (
          <div className="flex items-center gap-2 p-8 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" /> Đang nạp hồ sơ 4M từ iw_prod…
          </div>
        )
      )}
      <div hidden={status.state !== "ready"}>{children}</div>
    </>
  );
}
