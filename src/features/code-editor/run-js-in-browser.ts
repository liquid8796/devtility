/**
 * Runs JavaScript inside a sandboxed Web Worker (no DOM, no cookies, no parent
 * access) with a hard timeout. console.* output is captured and returned.
 */

export interface BrowserRunResult {
  logs: Array<{ type: "log" | "warn" | "error" | "info"; text: string }>;
  error: string | null;
  durationMs: number;
}

const WORKER_SOURCE = `
  const logs = [];
  const format = (value) => {
    if (typeof value === "string") return value;
    if (value instanceof Error) return value.stack || String(value);
    try {
      return JSON.stringify(value, null, 1);
    } catch {
      return String(value);
    }
  };
  for (const type of ["log", "warn", "error", "info"]) {
    console[type] = (...args) => {
      logs.push({ type, text: args.map(format).join(" ") });
      if (logs.length > 1000) {
        logs.push({ type: "warn", text: "— đã cắt bớt output (quá 1000 dòng) —" });
        finish(null);
      }
    };
  }
  let finished = false;
  const finish = (error) => {
    if (finished) return;
    finished = true;
    self.postMessage({ logs: logs.slice(0, 1001), error });
    self.close();
  };
  self.onmessage = async (event) => {
    const start = performance.now();
    try {
      const fn = new Function(event.data.code);
      const result = fn();
      if (result instanceof Promise) await result;
      finish(null);
    } catch (err) {
      finish(err instanceof Error ? (err.stack || err.message) : String(err));
    }
  };
`;

export function runJavaScriptInBrowser(code: string, timeoutMs = 5000): Promise<BrowserRunResult> {
  return new Promise((resolve) => {
    const blob = new Blob([WORKER_SOURCE], { type: "application/javascript" });
    const url = URL.createObjectURL(blob);
    const worker = new Worker(url);
    const start = performance.now();

    const cleanup = () => {
      worker.terminate();
      URL.revokeObjectURL(url);
    };

    const timer = setTimeout(() => {
      cleanup();
      resolve({
        logs: [],
        error: `Hết thời gian thực thi (${timeoutMs / 1000}s) — có thể code chứa vòng lặp vô hạn.`,
        durationMs: timeoutMs,
      });
    }, timeoutMs);

    worker.onmessage = (event: MessageEvent<{ logs: BrowserRunResult["logs"]; error: string | null }>) => {
      clearTimeout(timer);
      cleanup();
      resolve({ ...event.data, durationMs: Math.round(performance.now() - start) });
    };

    worker.onerror = (event) => {
      clearTimeout(timer);
      cleanup();
      resolve({
        logs: [],
        error: event.message || "Lỗi không xác định khi chạy code.",
        durationMs: Math.round(performance.now() - start),
      });
    };

    worker.postMessage({ code });
  });
}
