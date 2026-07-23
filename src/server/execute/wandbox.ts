import { ExecutionRateLimitError } from "./piston";
import type {
  ExecutionProvider,
  ExecutionRequest,
  ExecutionResult,
  RuntimeInfo,
  StageResult,
  SupportedLanguage,
} from "./types";

/**
 * Wandbox execution engine — https://wandbox.org (free, keyless).
 * Default provider since the public Piston API became whitelist-only (02/2026).
 * Provides OpenJDK 21/22, CPython 3.7–3.14 and Node.js.
 */

const BASE_URL = "https://wandbox.org/api";

interface WandboxCompiler {
  name: string;
  language: string;
  version: string;
  "display-name": string;
}

interface WandboxResult {
  status?: string;
  signal?: string;
  compiler_output?: string;
  compiler_error?: string;
  program_output?: string;
  program_error?: string;
  program_message?: string;
}

const LANGUAGE_MAP: Record<string, SupportedLanguage> = {
  Java: "java",
  Python: "python",
  JavaScript: "javascript",
};

/** Keep the version list short & stable: exclude HEAD builds, PyPy and Python 2. */
function isStableRuntime(compiler: WandboxCompiler): boolean {
  const name = compiler.name;
  if (name.includes("head")) return false;
  if (name.startsWith("pypy")) return false;
  if (name.startsWith("cpython-2")) return false;
  return true;
}

/**
 * Wandbox compiles a single `prog.java`, so a top-level `public` type would
 * fail javac's file-name rule. Demoting it to package-private is semantically
 * harmless for single-file programs and lets users keep `public class Main`.
 */
export function preprocessJava(code: string): string {
  return code.replace(
    /(^|\n)(\s*)public(\s+(?:final\s+|abstract\s+|sealed\s+|non-sealed\s+)*)(class|interface|enum|record)(\s)/,
    "$1$2$3$4$5",
  );
}

export class WandboxProvider implements ExecutionProvider {
  async listRuntimes(): Promise<RuntimeInfo[]> {
    const res = await fetch(`${BASE_URL}/list.json`, { next: { revalidate: 3600 } });
    if (!res.ok) throw new Error(`Wandbox /list.json trả về ${res.status}`);
    const compilers = (await res.json()) as WandboxCompiler[];

    return compilers
      .filter((c) => LANGUAGE_MAP[c.language] !== undefined && isStableRuntime(c))
      .map((c) => ({
        language: LANGUAGE_MAP[c.language],
        version: c.name,
        label: `${c["display-name"]} ${c.version}`.trim(),
      }));
  }

  async execute(request: ExecutionRequest): Promise<ExecutionResult> {
    const code = request.language === "java" ? preprocessJava(request.code) : request.code;

    const body: Record<string, string> = {
      compiler: request.version,
      code,
      stdin: request.stdin ?? "",
    };
    // Wandbox runs the JVM under a C (ASCII) locale, so System.out/err mangle
    // non-ASCII output into "?". Force UTF-8 for both javac and the runtime.
    // (Python is unaffected — CPython already defaults to UTF-8 there.)
    if (request.language === "java") {
      body["compiler-option-raw"] = "-encoding\nUTF-8";
      body["runtime-option-raw"] =
        "-Dstdout.encoding=UTF-8\n-Dstderr.encoding=UTF-8\n-Dfile.encoding=UTF-8";
    }

    const res = await fetch(`${BASE_URL}/compile.json`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    });

    if (res.status === 429) {
      throw new ExecutionRateLimitError();
    }
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new Error(`Máy chủ thực thi trả về ${res.status}: ${detail.slice(0, 200)}`);
    }

    const data = (await res.json()) as WandboxResult;
    const exitCode = data.status !== undefined && data.status !== "" ? Number(data.status) : null;

    const run: StageResult = {
      stdout: data.program_output ?? "",
      stderr: data.program_error ?? "",
      output: data.program_message ?? "",
      code: Number.isNaN(exitCode) ? null : exitCode,
      signal: data.signal || null,
    };

    const hasCompileOutput = Boolean(data.compiler_output || data.compiler_error);
    const compile: StageResult | undefined = hasCompileOutput
      ? {
          stdout: data.compiler_output ?? "",
          stderr: data.compiler_error ?? "",
          output: data.compiler_error ?? data.compiler_output ?? "",
          code: data.compiler_error ? 1 : 0,
          signal: null,
        }
      : undefined;

    return { language: request.language, version: request.version, run, compile };
  }
}
