import { NextResponse } from "next/server";

import { getRateProvider } from "@/server/rates/history";

export const runtime = "nodejs";

export async function GET(): Promise<NextResponse> {
  try {
    const currencies = await getRateProvider().listCurrencies();
    if (currencies.length === 0) {
      return NextResponse.json({ error: "Nguồn tỷ giá tạm thời không khả dụng" }, { status: 502 });
    }
    return NextResponse.json(
      { currencies },
      { headers: { "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=86400" } },
    );
  } catch (error) {
    console.error("[rates/currencies] failed:", error);
    return NextResponse.json({ error: "Không thể tải danh sách tiền tệ" }, { status: 500 });
  }
}
