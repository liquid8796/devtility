import type {
  ExecutionProvider,
  ExecutionRequest,
  ExecutionResult,
  ProviderCapabilities,
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

/** Piston ≥ 3.1 also reports wall_time / cpu_time (ms) and memory (bytes) per stage. */
interface PistonStage {
  stdout: string;
  stderr: string;
  output: string;
  code: number | null;
  signal: string | null;
  wall_time?: number | null;
  cpu_time?: number | null;
  memory?: number | null;
}

interface PistonExecuteResponse {
  language: string;
  version: string;
  run: PistonStage;
  compile?: PistonStage;
}

function toStageResult(stage: PistonStage): StageResult {
  return {
    stdout: stage.stdout,
    stderr: stage.stderr,
    output: stage.output,
    code: stage.code,
    signal: stage.signal,
    wallTimeMs: typeof stage.wall_time === "number" ? stage.wall_time : null,
    cpuTimeMs: typeof stage.cpu_time === "number" ? stage.cpu_time : null,
    memoryBytes: typeof stage.memory === "number" ? stage.memory : null,
  };
}

const FILE_NAMES: Record<SupportedLanguage, string> = {
  java: "Main.java",
  python: "main.py",
  javascript: "main.js",
};

export class PistonProvider implements ExecutionProvider {
  capabilities(): ProviderCapabilities {
    return {
      name: "piston",
      // Piston passes `args` straight to the program for every runtime.
      argsLanguages: [...SUPPORTED_LANGUAGES],
      reportsResourceUsage: true,
    };
  }

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
    const data = (await res.json()) as PistonExecuteResponse;
    return {
      language: data.language,
      version: data.version,
      run: toStageResult(data.run),
      compile: data.compile ? toStageResult(data.compile) : undefined,
    };
  }
}

export class ExecutionRateLimitError extends Error {
  constructor() {
    super("Hệ thống đang bận (giới hạn tần suất). Vui lòng thử lại sau vài giây.");
    this.name = "ExecutionRateLimitError";
  }
}
