import { NextResponse } from "next/server";

import { getRateProvider } from "@/server/rates/history";

export const runtime = "nodejs";

export async function GET(request: Request): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const base = searchParams.get("base") ?? "usd";

  try {
    const snapshot = await getRateProvider().getLatest(base);
    return NextResponse.json(snapshot, {
      headers: { "Cache-Control": "public, s-maxage=900, stale-while-revalidate=900" },
    });
  } catch (error) {
    console.error("[rates/latest] failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Không thể tải tỷ giá" },
      { status: 502 },
    );
  }
}
