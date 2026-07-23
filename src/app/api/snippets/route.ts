import { NextResponse } from "next/server";

import { SUPPORTED_LANGUAGES } from "@/server/execute/types";
import { checkRateLimit } from "@/server/rate-limit";
import { isBlobConfigured, saveSnippet } from "@/server/snippets/blob-store";

export const runtime = "nodejs";

const MAX_CODE_BYTES = 128 * 1024;
const RATE_LIMIT = 5;
const RATE_WINDOW_SECONDS = 60;

/** Client identity for rate limiting: first x-forwarded-for hop, then x-real-ip. */
function getClientId(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || request.headers.get("x-real-ip") || "unknown";
}

export async function POST(request: Request): Promise<NextResponse> {
  if (!isBlobConfigured()) {
    return NextResponse.json(
      { error: "Chức năng chia sẻ chưa được bật (thiếu cấu hình Blob Store)" },
      { status: 503 },
    );
  }

  const rate = await checkRateLimit({
    scope: "snippets",
    id: getClientId(request),
    limit: RATE_LIMIT,
    windowSeconds: RATE_WINDOW_SECONDS,
  });
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Bạn lưu snippet quá nhanh (tối đa 5 lần/phút). Vui lòng thử lại sau vài giây." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } },
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
    if (!(SUPPORTED_LANGUAGES as string[]).includes(language)) {
      return NextResponse.json(
        { error: `language phải là một trong: ${SUPPORTED_LANGUAGES.join(", ")}` },
        { status: 400 },
      );
    }
    if (new TextEncoder().encode(code).length > MAX_CODE_BYTES) {
      return NextResponse.json({ error: "Code vượt quá giới hạn 128 KB" }, { status: 413 });
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
