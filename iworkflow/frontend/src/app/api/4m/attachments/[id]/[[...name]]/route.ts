import { connection } from "next/server";
import { mimeOf } from "@/lib/file-types";
import { getProdAttachment } from "@/lib/server/prod-4m";

// Streams one attachment of a 4M case from iw_prod (read-only). The optional trailing file name only makes the URL
// readable (browser tab / PDF viewer title); `?download=1` forces a download instead of inline view.
export async function GET(request: Request, { params }: { params: Promise<{ id: string; name?: string[] }> }) {
  await connection();
  if (process.env.IW_DATA_SOURCE !== "prod") {
    return Response.json({ error: "Nguồn dữ liệu iw_prod chưa bật (IW_DATA_SOURCE=prod)." }, { status: 404 });
  }
  const { id } = await params;
  if (!/^\d+$/.test(id)) return Response.json({ error: "Mã tệp không hợp lệ." }, { status: 400 });
  try {
    const file = await getProdAttachment(id);
    if (!file) return Response.json({ error: "Không tìm thấy tệp." }, { status: 404 });
    const download = new URL(request.url).searchParams.get("download") === "1";
    const fallback = file.name.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
    return new Response(new Uint8Array(file.bytes), {
      headers: {
        "Content-Type": mimeOf(file.name),
        "Content-Length": String(file.bytes.length),
        "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(file.name)}`,
        "Cache-Control": "private, max-age=3600",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (e) {
    console.error("[4m/attachments]", e);
    return Response.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
