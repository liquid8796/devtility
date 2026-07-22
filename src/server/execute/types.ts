/**
 * Code-execution domain model (Strategy pattern).
 *
 * The default provider is the public Piston API (free, keyless). Because it is
 * abstracted behind `ExecutionProvider`, a self-hosted Piston (with more Java
 * versions installed) or Judge0 can be swapped in via the EXECUTE_API_URL env
 * without touching the UI or routes.
 */

export type SupportedLanguage = "java" | "python" | "javascript";

export const SUPPORTED_LANGUAGES: SupportedLanguage[] = ["java", "python", "javascript"];

export interface RuntimeInfo {
  language: SupportedLanguage;
  /** Provider-specific runtime id, sent back on execute (e.g. "openjdk-jdk-22+36") */
  version: string;
  /** Human-friendly display name (falls back to `version` in the UI) */
  label?: string;
}

export interface ExecutionRequest {
  language: SupportedLanguage;
  version: string;
  code: string;
  stdin?: string;
  args?: string[];
}

export interface StageResult {
  stdout: string;
  stderr: string;
  output: string;
  code: number | null;
  signal: string | null;
}

export interface ExecutionResult {
  language: string;
  version: string;
  run: StageResult;
  compile?: StageResult;
}

export interface ExecutionProvider {
  listRuntimes(): Promise<RuntimeInfo[]>;
  execute(request: ExecutionRequest): Promise<ExecutionResult>;
}
