"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Download, ExternalLink, FileQuestionMark, LoaderCircle, X, ZoomIn, ZoomOut } from "lucide-react";
import { fileKind } from "@/lib/file-types";
import type { Attachment } from "@/lib/fourm-case";
import { fmtDateTime, useLocale, useMessages, type Locale } from "@/lib/i18n";
import { personName } from "@/lib/people";

const vi = {
  viewFile: (name: string) => `Xem tệp ${name}`,
  openTab: "Mở trong tab mới",
  download: "Tải xuống",
  close: "Đóng",
  closeEsc: "Đóng (Esc)",
  prev: "Tệp trước",
  prevKey: "Tệp trước (←)",
  next: "Tệp sau",
  nextKey: "Tệp sau (→)",
  noContent: "Tệp này không có nội dung lưu trên hệ thống (chỉ còn tên tệp).",
  noPreview: "Chưa hỗ trợ xem trước loại tệp này.",
  loading: "Đang tải…",
  imageFailed: "Không tải được ảnh.",
  zoomOut: "Thu nhỏ",
  zoomIn: "Phóng to",
  fitToggle: "Vừa khung / 100%",
  fit: "Vừa",
  httpError: (status: number) => `Không tải được tệp (HTTP ${status}).`,
  sheetError: (e: string) => `Không đọc được bảng tính: ${e}`,
  emptySheet: "Trang tính trống.",
  truncated: (rows: number, cols: number) => `Chỉ hiển thị ${rows} dòng × ${cols} cột đầu – tải xuống để xem đầy đủ.`,
};
const M = {
  vi,
  en: {
    viewFile: (name) => `View file ${name}`,
    openTab: "Open in new tab",
    download: "Download",
    close: "Close",
    closeEsc: "Close (Esc)",
    prev: "Previous file",
    prevKey: "Previous file (←)",
    next: "Next file",
    nextKey: "Next file (→)",
    noContent: "This file has no stored content on the system (only its name is kept).",
    noPreview: "Preview is not supported for this file type yet.",
    loading: "Loading…",
    imageFailed: "Could not load the image.",
    zoomOut: "Zoom out",
    zoomIn: "Zoom in",
    fitToggle: "Fit / 100%",
    fit: "Fit",
    httpError: (status) => `Could not load the file (HTTP ${status}).`,
    sheetError: (e) => `Could not read the spreadsheet: ${e}`,
    emptySheet: "Empty sheet.",
    truncated: (rows, cols) => `Showing only the first ${rows} rows × ${cols} columns – download to see everything.`,
  },
} satisfies Record<Locale, typeof vi>;

// ---------------------------------------------------------------------------------------------
// Demo mode keeps uploaded files in memory only (the persisted case stores just name + size).
// ---------------------------------------------------------------------------------------------

const localFiles = new Map<string, string>();
const localKey = (caseCode: string, name: string) => `${caseCode}\n${name}`;

export function registerLocalFile(caseCode: string, file: File) {
  const key = localKey(caseCode, file.name);
  const old = localFiles.get(key);
  if (old) URL.revokeObjectURL(old);
  localFiles.set(key, URL.createObjectURL(file));
}

function sourceOf(caseCode: string, a: Attachment): { view: string; download: string } | null {
  if (a.id) {
    const base = `/api/4m/attachments/${encodeURIComponent(a.id)}/${encodeURIComponent(a.name)}`;
    return { view: base, download: `${base}?download=1` };
  }
  const local = localFiles.get(localKey(caseCode, a.name));
  return local ? { view: local, download: local } : null;
}

// ---------------------------------------------------------------------------------------------
// Viewer
// ---------------------------------------------------------------------------------------------

export function AttachmentViewer({
  caseCode,
  items,
  index,
  onIndex,
  onClose,
}: {
  caseCode: string;
  items: Attachment[];
  index: number;
  onIndex: (i: number) => void;
  onClose: () => void;
}) {
  const t = useMessages(M);
  const locale = useLocale();
  const a = items[index];
  const src = a ? sourceOf(caseCode, a) : null;
  const kind = a ? fileKind(a.name) : "other";
  const hasPrev = index > 0;
  const hasNext = index < items.length - 1;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft" && hasPrev) onIndex(index - 1);
      else if (e.key === "ArrowRight" && hasNext) onIndex(index + 1);
    };
    window.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [index, hasPrev, hasNext, onIndex, onClose]);

  if (!a) return null;
  const iconBtn = "inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-200 hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-transparent";

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-950/95 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label={t.viewFile(a.name)} onClick={onClose}>
      <div className="flex items-center gap-2 border-b border-white/10 px-4 py-2 text-slate-100" onClick={(e) => e.stopPropagation()}>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold" title={a.name}>
            {a.name}
          </p>
          <p className="truncate text-xs text-slate-400">
            {[a.size !== "—" ? a.size : "", personName(a.by), a.at ? fmtDateTime(a.at, locale) : ""].filter(Boolean).join(" · ")}
          </p>
        </div>
        {items.length > 1 && (
          <span className="text-xs text-slate-400">
            {index + 1}/{items.length}
          </span>
        )}
        {src && (
          <>
            <a href={src.view} target="_blank" rel="noopener noreferrer" className={iconBtn} title={t.openTab} aria-label={t.openTab}>
              <ExternalLink className="h-4 w-4" />
            </a>
            <a href={src.download} download={a.name} className={iconBtn} title={t.download} aria-label={t.download}>
              <Download className="h-4 w-4" />
            </a>
          </>
        )}
        <button type="button" className={iconBtn} onClick={onClose} title={t.closeEsc} aria-label={t.close} autoFocus>
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="relative min-h-0 flex-1">
        {hasPrev && (
          <button
            type="button"
            className="absolute left-3 top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/40 p-2 text-white hover:bg-black/60"
            onClick={(e) => {
              e.stopPropagation();
              onIndex(index - 1);
            }}
            aria-label={t.prev}
            title={t.prevKey}
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
        )}
        {hasNext && (
          <button
            type="button"
            className="absolute right-3 top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/40 p-2 text-white hover:bg-black/60"
            onClick={(e) => {
              e.stopPropagation();
              onIndex(index + 1);
            }}
            aria-label={t.next}
            title={t.nextKey}
          >
            <ChevronRight className="h-6 w-6" />
          </button>
        )}
        <div className="h-full p-4 sm:px-16">
          {!src ? (
            <Unsupported name={a.name} reason={t.noContent} />
          ) : kind === "image" ? (
            <ImageView key={src.view} src={src.view} name={a.name} />
          ) : kind === "pdf" ? (
            <iframe key={src.view} src={src.view} title={a.name} className="h-full w-full rounded bg-white" onClick={(e) => e.stopPropagation()} />
          ) : kind === "sheet" ? (
            <SheetView key={src.view} src={src.view} />
          ) : kind === "text" ? (
            <TextView key={src.view} src={src.view} />
          ) : (
            <Unsupported name={a.name} reason={t.noPreview} download={src.download} />
          )}
        </div>
      </div>
    </div>
  );
}

function Unsupported({ name, reason, download }: { name: string; reason: string; download?: string }) {
  const t = useMessages(M);
  return (
    <div className="flex h-full items-center justify-center">
      <div className="max-w-sm rounded-lg bg-white p-6 text-center shadow-xl" onClick={(e) => e.stopPropagation()}>
        <FileQuestionMark className="mx-auto h-10 w-10 text-slate-400" />
        <p className="mt-2 break-all text-sm font-medium text-slate-800">{name}</p>
        <p className="mt-1 text-xs text-slate-500">{reason}</p>
        {download && (
          <a href={download} download={name} className="mt-4 inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700">
            <Download className="h-4 w-4" /> {t.download}
          </a>
        )}
      </div>
    </div>
  );
}

function Loading() {
  const t = useMessages(M);
  return (
    <div className="flex h-full items-center justify-center text-sm text-slate-300">
      <LoaderCircle className="mr-2 h-5 w-5 animate-spin" /> {t.loading}
    </div>
  );
}

function ErrorBox({ message }: { message: string }) {
  return (
    <div className="flex h-full items-center justify-center">
      <p className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700" onClick={(e) => e.stopPropagation()}>
        {message}
      </p>
    </div>
  );
}

const ZOOMS = [0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4];

function ImageView({ src, name }: { src: string; name: string }) {
  const t = useMessages(M);
  const [zoom, setZoom] = useState<number | "fit">("fit");
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);
  const [failed, setFailed] = useState(false);
  if (failed) return <ErrorBox message={t.imageFailed} />;

  const current = zoom === "fit" ? 1 : zoom;
  const step = (dir: 1 | -1) => {
    const next = dir > 0 ? ZOOMS.find((z) => z > current) : [...ZOOMS].reverse().find((z) => z < current);
    if (next) setZoom(next);
  };
  const zoomBtn = "inline-flex h-7 min-w-7 items-center justify-center rounded px-1.5 text-xs text-white hover:bg-white/15";

  return (
    <div className="relative h-full">
      <div className={`h-full ${zoom === "fit" ? "flex items-center justify-center" : "overflow-auto"}`}>
        {/* eslint-disable-next-line @next/next/no-img-element -- arbitrary user files served by our API */}
        <img
          src={src}
          alt={name}
          onClick={(e) => {
            e.stopPropagation();
            setZoom(zoom === "fit" ? 1 : "fit");
          }}
          onLoad={(e) => setNatural({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
          onError={() => setFailed(true)}
          className={zoom === "fit" ? "max-h-full max-w-full cursor-zoom-in object-contain shadow-2xl" : "m-auto max-w-none cursor-zoom-out"}
          style={zoom !== "fit" && natural ? { width: natural.w * zoom, height: natural.h * zoom } : undefined}
        />
      </div>
      {!natural && <div className="absolute inset-0">{<Loading />}</div>}
      <div className="absolute bottom-2 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-md bg-black/60 p-1" onClick={(e) => e.stopPropagation()}>
        <button type="button" className={zoomBtn} onClick={() => step(-1)} aria-label={t.zoomOut} title={t.zoomOut}>
          <ZoomOut className="h-4 w-4" />
        </button>
        <button type="button" className={`${zoomBtn} w-14`} onClick={() => setZoom(zoom === "fit" ? 1 : "fit")} title={t.fitToggle}>
          {zoom === "fit" ? t.fit : `${Math.round(zoom * 100)}%`}
        </button>
        <button type="button" className={zoomBtn} onClick={() => step(1)} aria-label={t.zoomIn} title={t.zoomIn}>
          <ZoomIn className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

class HttpError extends Error {
  constructor(readonly status: number) {
    super(`HTTP ${status}`);
  }
}

/** HTTP failures keep their status so the message follows the current locale. */
function useFetched<T>(src: string, read: (r: Response) => Promise<T>) {
  const t = useMessages(M);
  const [state, setState] = useState<{ data?: T; error?: string; status?: number }>({});
  useEffect(() => {
    let alive = true;
    fetch(src)
      .then(async (r) => {
        if (!r.ok) throw new HttpError(r.status);
        return read(r);
      })
      .then((data) => alive && setState({ data }))
      .catch((e: unknown) => alive && setState(e instanceof HttpError ? { status: e.status } : { error: e instanceof Error ? e.message : String(e) }));
    return () => {
      alive = false;
    };
    // `read` is a stable module-level parser for each caller.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src]);
  return { data: state.data, error: state.status ? t.httpError(state.status) : state.error };
}

function TextView({ src }: { src: string }) {
  const { data, error } = useFetched(src, (r) => r.text());
  if (error) return <ErrorBox message={error} />;
  if (data === undefined) return <Loading />;
  return (
    <pre className="h-full overflow-auto whitespace-pre-wrap rounded bg-white p-4 text-xs text-slate-800" onClick={(e) => e.stopPropagation()}>
      {data}
    </pre>
  );
}

const MAX_ROWS = 2000;
const MAX_COLS = 100;

type Sheet = { name: string; rows: string[][]; cols: string[]; startRow: number; truncated: boolean };

async function parseWorkbook(r: Response): Promise<Sheet[]> {
  const XLSX = await import("xlsx");
  const wb = XLSX.read(await r.arrayBuffer(), { type: "array", cellDates: true });
  return wb.SheetNames.map((name) => {
    const ws = wb.Sheets[name];
    if (!ws?.["!ref"]) return { name, rows: [], cols: [], startRow: 1, truncated: false };
    const full = XLSX.utils.decode_range(ws["!ref"]);
    const range = { s: full.s, e: { r: Math.min(full.e.r, full.s.r + MAX_ROWS - 1), c: Math.min(full.e.c, full.s.c + MAX_COLS - 1) } };
    const rows = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1, range, raw: false, defval: "", blankrows: true });
    const cols = Array.from({ length: range.e.c - range.s.c + 1 }, (_, i) => XLSX.utils.encode_col(range.s.c + i));
    return { name, rows, cols, startRow: range.s.r + 1, truncated: range.e.r < full.e.r || range.e.c < full.e.c };
  });
}

function SheetView({ src }: { src: string }) {
  const t = useMessages(M);
  const { data, error } = useFetched(src, parseWorkbook);
  const [active, setActive] = useState(0);
  if (error) return <ErrorBox message={t.sheetError(error)} />;
  if (!data) return <Loading />;
  const sheet = data[active];

  return (
    <div className="flex h-full flex-col overflow-hidden rounded bg-white" onClick={(e) => e.stopPropagation()}>
      <div className="min-h-0 flex-1 overflow-auto">
        {!sheet || sheet.rows.length === 0 ? (
          <p className="p-4 text-sm text-slate-500">{t.emptySheet}</p>
        ) : (
          <table className="border-separate border-spacing-0 text-xs text-slate-800">
            <thead>
              <tr>
                <th className="sticky left-0 top-0 z-20 border-b border-r border-slate-300 bg-slate-100" />
                {sheet.cols.map((c) => (
                  <th key={c} className="sticky top-0 z-10 min-w-16 border-b border-r border-slate-300 bg-slate-100 px-2 py-1 font-medium text-slate-500">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sheet.rows.map((row, r) => (
                <tr key={r}>
                  <th className="sticky left-0 z-10 border-b border-r border-slate-300 bg-slate-100 px-2 py-0.5 text-right font-medium text-slate-500">{sheet.startRow + r}</th>
                  {sheet.cols.map((c, i) => (
                    <td key={c} className="max-w-xs truncate whitespace-nowrap border-b border-r border-slate-200 px-2 py-0.5" title={row[i] || undefined}>
                      {row[i]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <div className="flex items-center gap-1 overflow-x-auto border-t border-slate-200 bg-slate-50 px-2 py-1">
        {data.map((s, i) => (
          <button
            key={s.name + i}
            type="button"
            onClick={() => setActive(i)}
            className={`shrink-0 rounded px-2.5 py-1 text-xs ${i === active ? "bg-white font-semibold text-blue-700 shadow-sm" : "text-slate-600 hover:bg-slate-200"}`}
          >
            {s.name}
          </button>
        ))}
        {sheet?.truncated && <span className="ml-auto shrink-0 pl-2 text-[11px] text-amber-700">{t.truncated(MAX_ROWS, MAX_COLS)}</span>}
      </div>
    </div>
  );
}
