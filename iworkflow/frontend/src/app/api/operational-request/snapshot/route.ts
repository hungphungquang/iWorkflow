import { connection } from "next/server";
import { getOperationalRequestSnapshot } from "@/lib/server/prod-operational-request";

export async function GET() {
  await connection();
  if (process.env.IW_DATA_SOURCE !== "prod") {
    return Response.json({ error: "Nguồn dữ liệu production chưa được bật." }, { status: 404 });
  }
  try {
    return Response.json(await getOperationalRequestSnapshot(), { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "Không tải được dữ liệu Operational Request Form. Vui lòng thử lại." }, { status: 500 });
  }
}