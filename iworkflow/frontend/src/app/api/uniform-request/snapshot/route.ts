import { connection } from "next/server";
import { getUniformRequestSnapshot } from "@/lib/server/prod-uniform-request";

export async function GET() {
  await connection();
  if (process.env.IW_DATA_SOURCE !== "prod") {
    return Response.json({ error: "Nguồn dữ liệu production chưa được bật." }, { status: 404 });
  }
  try {
    return Response.json(await getUniformRequestSnapshot(), { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "Không tải được dữ liệu yêu cầu cấp đồng phục. Vui lòng thử lại." }, { status: 500 });
  }
}
