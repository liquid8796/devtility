import { NextResponse } from "next/server";

import { getPairHistory, isHistoryRange } from "@/server/rates/history";

export const runtime = "nodejs";
// Building a fresh range can take several upstream fetches on cold cache
export const maxDuration = 60;

export async function GET(request: Request): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const base = searchParams.get("base") ?? "usd";
  const quote = searchParams.get("quote") ?? "vnd";
  const range = searchParams.get("range") ?? "1m";

  if (!isHistoryRange(range)) {
    return NextResponse.json({ error: "range phải là 7d | 1m | 3m | 1y" }, { status: 400 });
  }

  try {
    const points = await getPairHistory(base, quote, range);
    return NextResponse.json(
      { base: base.toLowerCase(), quote: quote.toLowerCase(), range, points },
      { headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=3600" } },
    );
  } catch (error) {
    console.error("[rates/history] failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Không thể tải lịch sử tỷ giá" },
      { status: 502 },
    );
  }
}
