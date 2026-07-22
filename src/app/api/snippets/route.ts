import { NextResponse } from "next/server";

import { isBlobConfigured, saveSnippet } from "@/server/snippets/blob-store";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<NextResponse> {
  if (!isBlobConfigured()) {
    return NextResponse.json(
      { error: "Chức năng chia sẻ chưa được bật (thiếu cấu hình Blob Store)" },
      { status: 503 },
    );
  }

  try {
    const body = (await request.json()) as { language?: unknown; version?: unknown; code?: unknown };
    const language = typeof body.language === "string" ? body.language.slice(0, 20) : "";
    const code = typeof body.code === "string" ? body.code : "";
    const version = typeof body.version === "string" ? body.version.slice(0, 20) : undefined;

    if (!language || !code.trim()) {
      return NextResponse.json({ error: "Thiếu language hoặc code" }, { status: 400 });
    }

    const { id } = await saveSnippet({ language, version, code });
    return NextResponse.json({ id });
  } catch (error) {
    console.error("[snippets] save failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Không lưu được snippet" },
      { status: 500 },
    );
  }
}
