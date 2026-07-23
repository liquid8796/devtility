import { NextResponse } from "next/server";

import { getExecutionProvider } from "@/server/execute";

export const runtime = "nodejs";

export async function GET(): Promise<NextResponse> {
  try {
    const provider = getExecutionProvider();
    const runtimes = await provider.listRuntimes();
    return NextResponse.json(
      { runtimes, capabilities: provider.capabilities() },
      { headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=3600" } },
    );
  } catch (error) {
    console.error("[execute/runtimes] failed:", error);
    return NextResponse.json({ error: "Không lấy được danh sách runtime" }, { status: 502 });
  }
}
