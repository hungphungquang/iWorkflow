import { connection } from "next/server";
import { getWorkingStandardSnapshot } from "@/lib/server/prod-working-standard";

export async function GET() {
  await connection();
  if (process.env.IW_DATA_SOURCE !== "prod") {
    return Response.json({ error: "Nguồn dữ liệu production chưa được bật." }, { status: 404 });
  }
  try {
    return Response.json(await getWorkingStandardSnapshot(), { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "Không tải được dữ liệu Working Standard. Vui lòng thử lại." }, { status: 500 });
  }
}