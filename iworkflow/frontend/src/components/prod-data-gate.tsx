"use client";

import { useEffect } from "react";
import { Database, Loader2, RotateCcw } from "lucide-react";
import { fmtDateTime, useLocale, useMessages, type Locale } from "@/lib/i18n";
import { loadProdSnapshot, READ_ONLY, useProdStatus } from "@/lib/store";

const vi = {
  readOnly: "Dữ liệu thật iw_prod · chỉ đọc.",
  readOnlyHint: "Thao tác xử lý vẫn thực hiện trên iWorkflow hiện tại.",
  loaded: (n: number, at: string) => `${n} hồ sơ · nạp lúc ${at}`,
  reload: "Tải lại",
  error: "Không nạp được dữ liệu từ iw_prod",
  errorHint: "Kiểm tra kết nối VPN/LAN tới máy chủ CSDL và mật khẩu trong pgpass.conf hoặc IW_DB_PASSWORD.",
  loading: "Đang nạp hồ sơ 4M từ iw_prod…",
};
const M = {
  vi,
  en: {
    readOnly: "Live iw_prod data · read-only.",
    readOnlyHint: "Processing is still done in the current iWorkflow.",
    loaded: (n, at) => `${n} cases · loaded at ${at}`,
    reload: "Reload",
    error: "Could not load data from iw_prod",
    errorHint: "Check the VPN/LAN connection to the database server and the password in pgpass.conf or IW_DB_PASSWORD.",
    loading: "Loading 4M cases from iw_prod…",
  },
} satisfies Record<Locale, typeof vi>;

/** In iw_prod read-only mode: loads the snapshot once and holds the page until the real data is in. */
export function ProdDataGate({ children }: { children: React.ReactNode }) {
  const status = useProdStatus();
  const locale = useLocale();
  const t = useMessages(M);

  useEffect(() => {
    void loadProdSnapshot();
  }, []);

  if (!READ_ONLY) return <>{children}</>;

  const banner = (
    <div className="mb-4 flex flex-wrap items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs text-amber-900" role="status">
      <Database className="h-3.5 w-3.5" aria-hidden />
      <span>
        <b>{t.readOnly}</b> {t.readOnlyHint}
      </span>
      {status.state === "ready" && (
        <span className="text-amber-700">
          {t.loaded(status.count ?? 0, fmtDateTime(status.loadedAt ?? "", locale))}
        </span>
      )}
      <button
        type="button"
        disabled={status.state === "loading"}
        onClick={() => void loadProdSnapshot(true)}
        className="ml-auto inline-flex items-center gap-1 rounded border border-amber-300 bg-white px-2 py-0.5 hover:bg-amber-100 disabled:opacity-50"
      >
        {status.state === "loading" ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCcw className="h-3 w-3" />} {t.reload}
      </button>
    </div>
  );

  // Children stay mounted (hidden) while loading so the route segment is always rendered.
  return (
    <>
      {banner}
      {status.state === "error" ? (
        <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <p className="font-semibold">{t.error}</p>
          <p className="mt-1 font-mono text-xs">{status.error}</p>
          <p className="mt-2 text-xs">{t.errorHint}</p>
        </div>
      ) : (
        status.state !== "ready" && (
          <div className="flex items-center gap-2 p-8 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" /> {t.loading}
          </div>
        )
      )}
      <div hidden={status.state !== "ready"}>{children}</div>
    </>
  );
}
