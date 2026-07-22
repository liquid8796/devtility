import { NextResponse } from "next/server";

import { getExecutionProvider } from "@/server/execute";

export const runtime = "nodejs";

export async function GET(): Promise<NextResponse> {
  try {
    const runtimes = await getExecutionProvider().listRuntimes();
    return NextResponse.json(
      { runtimes },
      { headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=3600" } },
    );
  } catch (error) {
    console.error("[execute/runtimes] failed:", error);
    return NextResponse.json({ error: "Không lấy được danh sách runtime" }, { status: 502 });
  }
}
