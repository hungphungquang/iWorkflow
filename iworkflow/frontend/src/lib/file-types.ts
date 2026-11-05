export type FileKind = "image" | "pdf" | "sheet" | "text" | "other";

const ext = (name: string) => /\.([a-z0-9]+)$/i.exec(name)?.[1]?.toLowerCase() ?? "";

const IMAGE: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  jfif: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  bmp: "image/bmp",
  webp: "image/webp",
};
const SHEET = new Set(["xlsx", "xlsm", "xlsb", "xls", "ods", "csv"]);
const TEXT = new Set(["txt", "log"]);

export function fileKind(name: string): FileKind {
  const e = ext(name);
  if (e in IMAGE) return "image";
  if (e === "pdf") return "pdf";
  if (SHEET.has(e)) return "sheet";
  if (TEXT.has(e)) return "text";
  return "other";
}

/** Only types the browser renders safely inline get a specific MIME type; everything else is a plain download. */
export function mimeOf(name: string): string {
  const e = ext(name);
  if (e in IMAGE) return IMAGE[e];
  if (e === "pdf") return "application/pdf";
  if (TEXT.has(e) || e === "csv") return "text/plain; charset=utf-8";
  return "application/octet-stream";
}
