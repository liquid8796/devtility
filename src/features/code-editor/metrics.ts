/**
 * Run metrics collected after an execution (server engines report what they
 * can — see ProviderCapabilities; the browser runner only knows duration).
 */
export interface RunMetrics {
  /** Total wall-clock time in ms (engine-reported when available, else measured) */
  durationMs: number | null;
  /** CPU time in ms — Piston only */
  cpuTimeMs: number | null;
  /** Peak memory in bytes — Piston only */
  memoryBytes: number | null;
  /** Size of stdout + stderr in bytes */
  outputBytes: number;
  /** Program exit code (null: unknown, e.g. killed or browser run failure) */
  exitCode: number | null;
  /** Termination signal, if the engine killed the program (e.g. SIGKILL on timeout) */
  signal: string | null;
  /** Runtime label, e.g. "Java OpenJDK jdk-22+36" or "JavaScript (browser)" */
  runtimeLabel: string;
}

export function utf8Bytes(text: string): number {
  return new TextEncoder().encode(text).length;
}

/** 1234 → "1.23 KB"; sizes below 1 KB stay in bytes. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/** 850 → "850 ms"; 12500 → "12.5 s". */
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)} ms`;
  return `${(ms / 1000).toFixed(2).replace(/\.?0+$/, "")} s`;
}
