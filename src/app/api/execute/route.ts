import { NextResponse } from "next/server";

import { ExecutionRateLimitError, getExecutionProvider } from "@/server/execute";
import { SUPPORTED_LANGUAGES, type SupportedLanguage } from "@/server/execute/types";
import { checkRateLimit } from "@/server/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_CODE_BYTES = 128 * 1024;
const MAX_STDIN_BYTES = 16 * 1024;
const MAX_ARGS = 16;
const MAX_ARG_BYTES = 512;
const MAX_ARGS_TOTAL_BYTES = 4 * 1024;
const RATE_LIMIT = 10;
const RATE_WINDOW_SECONDS = 60;

/** Client identity for rate limiting: first x-forwarded-for hop, then x-real-ip. */
function getClientId(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || request.headers.get("x-real-ip") || "unknown";
}

interface ExecuteBody {
  language?: unknown;
  version?: unknown;
  code?: unknown;
  stdin?: unknown;
  args?: unknown;
}

/**
 * Validates command-line args: array of newline-free strings within size limits.
 * Returns the parsed array, or an error message when invalid.
 */
function parseArgsField(raw: unknown): { args: string[] } | { error: string } {
  if (raw === undefined || raw === null) return { args: [] };
  if (!Array.isArray(raw) || raw.some((a) => typeof a !== "string")) {
    return { error: "args phải là mảng chuỗi" };
  }
  const args = raw as string[];
  if (args.length > MAX_ARGS) {
    return { error: `Tối đa ${MAX_ARGS} tham số dòng lệnh` };
  }
  if (args.some((a) => a.includes("\n") || a.includes("\r"))) {
    return { error: "Tham số dòng lệnh không được chứa ký tự xuống dòng" };
  }
  const encoder = new TextEncoder();
  let total = 0;
  for (const arg of args) {
    const bytes = encoder.encode(arg).length;
    if (bytes > MAX_ARG_BYTES) {
      return { error: `Mỗi tham số tối đa ${MAX_ARG_BYTES} byte` };
    }
    total += bytes;
  }
  if (total > MAX_ARGS_TOTAL_BYTES) {
    return { error: `Tổng kích thước tham số vượt quá ${MAX_ARGS_TOTAL_BYTES / 1024} KB` };
  }
  return { args };
}

export async function POST(request: Request): Promise<NextResponse> {
  const rate = await checkRateLimit({
    scope: "execute",
    id: getClientId(request),
    limit: RATE_LIMIT,
    windowSeconds: RATE_WINDOW_SECONDS,
  });
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Bạn gửi yêu cầu quá nhanh (tối đa 10 lần/phút). Vui lòng thử lại sau vài giây." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } },
    );
  }

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

  const parsedArgs = parseArgsField(body.args);
  if ("error" in parsedArgs) {
    return NextResponse.json({ error: parsedArgs.error }, { status: 400 });
  }
  const { args } = parsedArgs;

  const provider = getExecutionProvider();
  const capabilities = provider.capabilities();
  if (args.length > 0 && !capabilities.argsLanguages.includes(language as SupportedLanguage)) {
    return NextResponse.json(
      {
        error: `Engine ${capabilities.name} không hỗ trợ tham số dòng lệnh cho ${language}. Hãy bỏ trống ô tham số.`,
      },
      { status: 400 },
    );
  }

  try {
    const startedAt = Date.now();
    const result = await provider.execute({
      language: language as SupportedLanguage,
      version,
      code,
      stdin,
      args,
    });
    // Wall-clock fallback for engines that don't report timings (includes engine queue/network)
    return NextResponse.json({ ...result, durationMs: Date.now() - startedAt });
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
