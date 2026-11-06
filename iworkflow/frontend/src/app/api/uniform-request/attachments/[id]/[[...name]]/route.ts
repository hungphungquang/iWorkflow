import { connection } from "next/server";
import { mimeOf } from "@/lib/file-types";
import { getUniformRequestAttachment } from "@/lib/server/prod-uniform-request";

export async function GET(request: Request, { params }: { params: Promise<{ id: string; name?: string[] }> }) {
  await connection();
  if (process.env.IW_DATA_SOURCE !== "prod") return Response.json({ error: "Nguồn dữ liệu production chưa được bật." }, { status: 404 });
  const { id } = await params;
  if (!/^\d+$/.test(id)) return Response.json({ error: "Mã tệp không hợp lệ." }, { status: 400 });
  try {
    const file = await getUniformRequestAttachment(id);
    if (!file) return Response.json({ error: "Không tìm thấy tệp thuộc yêu cầu cấp đồng phục." }, { status: 404 });
    const download = new URL(request.url).searchParams.get("download") === "1";
    const fallback = file.name.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
    return new Response(new Uint8Array(file.bytes), { headers: {
      "Content-Type": mimeOf(file.name),
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(file.name)}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    } });
  } catch {
    return Response.json({ error: "Không tải được tài liệu." }, { status: 500 });
  }
}
