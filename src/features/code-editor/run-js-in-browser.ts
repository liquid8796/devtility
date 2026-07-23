/**
 * Runs JavaScript inside a sandboxed Web Worker (no DOM, no cookies, no parent
 * access) with a hard timeout. Network/storage escape hatches (fetch, XHR,
 * WebSocket, importScripts, …) are neutralized before user code runs.
 * console.* output is captured and returned.
 */

export interface BrowserRunResult {
  logs: Array<{ type: "log" | "warn" | "error" | "info"; text: string }>;
  error: string | null;
  durationMs: number;
}

const WORKER_SOURCE = `
  // Capture internals first so user code cannot tamper with them.
  const post = self.postMessage.bind(self);
  const close = self.close.bind(self);
  const schedule = self.setTimeout.bind(self);
  // Neutralize network/storage escape hatches; a failure on one must not crash the run.
  for (const key of ["fetch", "XMLHttpRequest", "WebSocket", "EventSource", "importScripts", "indexedDB", "caches"]) {
    try {
      Object.defineProperty(self, key, { value: undefined, writable: false, configurable: false });
    } catch {
      try {
        self[key] = undefined;
      } catch {}
      try {
        delete self[key];
      } catch {}
    }
  }
  try {
    if (self.navigator && "sendBeacon" in self.navigator) {
      Object.defineProperty(self.navigator, "sendBeacon", { value: undefined, writable: false, configurable: false });
    }
  } catch {}
  const MAX_LOGS = 1000;
  const logs = [];
  let truncated = false;
  let finished = false;
  const format = (value) => {
    if (typeof value === "string") return value;
    if (value instanceof Error) return value.stack || String(value);
    try {
      return JSON.stringify(value, null, 1);
    } catch {
      return String(value);
    }
  };
  const finish = (error) => {
    if (finished) return;
    finished = true;
    if (truncated) {
      logs.push({ type: "warn", text: "— đã cắt bớt output (quá 1000 dòng) / output truncated (over 1000 lines) —" });
    }
    post({ logs, error });
    close();
  };
  for (const type of ["log", "warn", "error", "info"]) {
    console[type] = (...args) => {
      if (finished) return;
      if (logs.length >= MAX_LOGS) {
        if (!truncated) {
          truncated = true;
          finish(null);
        }
        return;
      }
      logs.push({ type, text: args.map(format).join(" ") });
    };
  }
  self.onmessage = async (event) => {
    try {
      const fn = new Function(event.data.code);
      const result = fn();
      if (result instanceof Promise) await result;
      // Grace period so console output from already-queued 0ms callbacks still flushes.
      schedule(() => finish(null), 50);
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
