import { connection } from "next/server";
import { getProdSnapshot } from "@/lib/server/prod-4m";

// Read-only 4M snapshot from iw_prod. Enabled only when IW_DATA_SOURCE=prod (set in .env.local, never committed).
export async function GET(request: Request) {
  await connection();
  if (process.env.IW_DATA_SOURCE !== "prod") {
    return Response.json({ error: "Nguồn dữ liệu iw_prod chưa bật (IW_DATA_SOURCE=prod)." }, { status: 404 });
  }
  const refresh = new URL(request.url).searchParams.get("refresh") === "1";
  try {
    const snap = await getProdSnapshot(refresh);
    return Response.json(snap, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    console.error("[4m/snapshot]", e);
    return Response.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
