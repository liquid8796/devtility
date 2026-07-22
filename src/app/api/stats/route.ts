import { NextResponse } from "next/server";

import { getAnalyticsRepository } from "@/server/analytics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  try {
    const stats = await getAnalyticsRepository().getStats();
    return NextResponse.json(stats, {
      headers: { "Cache-Control": "private, max-age=30" },
    });
  } catch (error) {
    console.error("[stats] failed:", error);
    return NextResponse.json({ error: "Không thể tải thống kê" }, { status: 500 });
  }
}
