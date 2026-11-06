import { connection } from "next/server";
import { getOperationalRequestBarcodes } from "@/lib/server/prod-operational-request";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  await connection();
  if (process.env.IW_DATA_SOURCE !== "prod") return Response.json({ error: "Nguồn dữ liệu production chưa được bật." }, { status: 404 });
  const { id } = await params;
  if (!/^\d+$/.test(id)) return Response.json({ error: "Mã hồ sơ không hợp lệ." }, { status: 400 });
  try {
    const barcodes = await getOperationalRequestBarcodes(id);
    if (!barcodes) return Response.json({ error: "Không tìm thấy hồ sơ Operational Request Form." }, { status: 404 });
    return Response.json({ id, barcodes }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "Không tải được danh sách barcode." }, { status: 500 });
  }
}