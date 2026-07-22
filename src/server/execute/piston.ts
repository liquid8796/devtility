import type {
  ExecutionProvider,
  ExecutionRequest,
  ExecutionResult,
  RuntimeInfo,
  StageResult,
  SupportedLanguage,
} from "./types";
import { SUPPORTED_LANGUAGES } from "./types";

/**
 * Piston execution engine — https://github.com/engineer-man/piston
 * Default: the free public instance (rate-limited ~5 req/s).
 * Self-host Piston and set EXECUTE_API_URL to unlock more runtimes
 * (e.g. additional Java versions) with zero code changes.
 */

const BASE_URL = process.env.EXECUTE_API_URL ?? "https://emkc.org/api/v2/piston";

interface PistonRuntime {
  language: string;
  version: string;
  aliases: string[];
}

interface PistonExecuteResponse {
  language: string;
  version: string;
  run: StageResult;
  compile?: StageResult;
}

const FILE_NAMES: Record<SupportedLanguage, string> = {
  java: "Main.java",
  python: "main.py",
  javascript: "main.js",
};

export class PistonProvider implements ExecutionProvider {
  async listRuntimes(): Promise<RuntimeInfo[]> {
    const res = await fetch(`${BASE_URL}/runtimes`, { next: { revalidate: 3600 } });
    if (!res.ok) throw new Error(`Piston /runtimes trả về ${res.status}`);
    const runtimes = (await res.json()) as PistonRuntime[];

    return runtimes
      .filter((r): r is PistonRuntime & { language: SupportedLanguage } =>
        (SUPPORTED_LANGUAGES as string[]).includes(r.language),
      )
      .map((r) => ({ language: r.language, version: r.version }));
  }

  async execute(request: ExecutionRequest): Promise<ExecutionResult> {
    const res = await fetch(`${BASE_URL}/execute`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        language: request.language,
        version: request.version,
        files: [{ name: FILE_NAMES[request.language], content: request.code }],
        stdin: request.stdin ?? "",
        args: request.args ?? [],
        compile_timeout: 10_000,
        run_timeout: 10_000,
      }),
      cache: "no-store",
    });

    if (res.status === 429) {
      throw new ExecutionRateLimitError();
    }
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new Error(`Máy chủ thực thi trả về ${res.status}: ${detail.slice(0, 200)}`);
    }
    return (await res.json()) as PistonExecuteResponse;
  }
}

export class ExecutionRateLimitError extends Error {
  constructor() {
    super("Hệ thống đang bận (giới hạn tần suất). Vui lòng thử lại sau vài giây.");
    this.name = "ExecutionRateLimitError";
  }
}
