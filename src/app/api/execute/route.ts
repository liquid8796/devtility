import { NextResponse } from "next/server";

import { ExecutionRateLimitError, getExecutionProvider } from "@/server/execute";
import { SUPPORTED_LANGUAGES, type SupportedLanguage } from "@/server/execute/types";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_CODE_BYTES = 128 * 1024;
const MAX_STDIN_BYTES = 16 * 1024;

interface ExecuteBody {
  language?: unknown;
  version?: unknown;
  code?: unknown;
  stdin?: unknown;
}

export async function POST(request: Request): Promise<NextResponse> {
  let body: ExecuteBody;
  try {
    body = (await request.json()) as ExecuteBody;
  } catch {
    return NextResponse.json({ error: "Body phải là JSON hợp lệ" }, { status: 400 });
  }

  const language = body.language;
  if (typeof language !== "string" || !(SUPPORTED_LANGUAGES as string[]).includes(language)) {
    return NextResponse.json(
      { error: `language phải là một trong: ${SUPPORTED_LANGUAGES.join(", ")}` },
      { status: 400 },
    );
  }
  const code = typeof body.code === "string" ? body.code : "";
  if (!code.trim()) {
    return NextResponse.json({ error: "Chưa có code để chạy" }, { status: 400 });
  }
  if (new TextEncoder().encode(code).length > MAX_CODE_BYTES) {
    return NextResponse.json({ error: "Code vượt quá giới hạn 128 KB" }, { status: 413 });
  }
  const stdin = typeof body.stdin === "string" ? body.stdin : "";
  if (new TextEncoder().encode(stdin).length > MAX_STDIN_BYTES) {
    return NextResponse.json({ error: "Stdin vượt quá giới hạn 16 KB" }, { status: 413 });
  }
  const version = typeof body.version === "string" && body.version ? body.version : "*";

  try {
    const result = await getExecutionProvider().execute({
      language: language as SupportedLanguage,
      version,
      code,
      stdin,
    });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof ExecutionRateLimitError) {
      return NextResponse.json({ error: error.message }, { status: 429 });
    }
    console.error("[execute] failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Thực thi thất bại" },
      { status: 502 },
    );
  }
}
