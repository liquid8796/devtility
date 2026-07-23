"use client";

import { java } from "@codemirror/lang-java";
import { javascript } from "@codemirror/lang-javascript";
import { python } from "@codemirror/lang-python";
import { vscodeDark, vscodeLight } from "@uiw/codemirror-theme-vscode";
import CodeMirror from "@uiw/react-codemirror";
import { Cpu, FileText, Loader2, MemoryStick, Play, RotateCcw, Share2, Terminal, Timer } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { CopyButton } from "@/components/ui/copy-button";
import { Label, Select, TextArea, TextInput } from "@/components/ui/field";
import type { Localized } from "@/lib/i18n";
import { useI18n } from "@/lib/i18n/use-lang";
import type { ProviderCapabilities, StageResult, SupportedLanguage } from "@/server/execute/types";
import { cn } from "@/lib/utils";

import { completionExtensions, type CompletionMode } from "./completion";
import { formatBytes, formatDuration, utf8Bytes, type RunMetrics } from "./metrics";
import { parseArgs } from "./parse-args";
import { runJavaScriptInBrowser } from "./run-js-in-browser";
import { LANGUAGE_LABELS, SAMPLES } from "./samples";

const M = {
  editorTitle: { vi: "Trình soạn thảo", en: "Editor" },
  subtitleJs: {
    vi: "JavaScript chạy trực tiếp trong trình duyệt của bạn (Web Worker sandbox)",
    en: "JavaScript runs right in your browser (Web Worker sandbox)",
  },
  subtitleServer: {
    vi: "Java & Python chạy trên server (engine Wandbox — miễn phí, không cần key)",
    en: "Java & Python run server-side (Wandbox engine — free, no key required)",
  },
  languageAria: { vi: "Ngôn ngữ", en: "Language" },
  versionAria: { vi: "Phiên bản", en: "Version" },
  completionAria: { vi: "Chế độ gợi ý code", en: "Code completion mode" },
  completionOff: { vi: "Tắt gợi ý", en: "No completion" },
  completionBasic: { vi: "Basic Completion", en: "Basic Completion" },
  completionSmart: { vi: "Smart Completion", en: "Smart Completion" },
  editorAria: { vi: "Vùng soạn thảo code", en: "Code editing area" },
  run: { vi: "Chạy code", en: "Run code" },
  sample: { vi: "Code mẫu", en: "Sample code" },
  share: { vi: "Chia sẻ", en: "Share" },
  copyCode: { vi: "Sao chép code", en: "Copy code" },
  stdinLabel: { vi: "Stdin (đầu vào chương trình)", en: "Stdin (program input)" },
  stdinPlaceholderJs: {
    vi: "JavaScript trong trình duyệt không dùng stdin",
    en: "In-browser JavaScript does not use stdin",
  },
  stdinPlaceholder: { vi: "Mỗi dòng một giá trị…", en: "One value per line…" },
  argsLabel: { vi: "Tham số dòng lệnh (args)", en: "Command-line arguments" },
  argsPlaceholder: {
    vi: 'vd: --mode fast "giá trị có khoảng trắng"',
    en: 'e.g. --mode fast "value with spaces"',
  },
  argsPlaceholderJs: {
    vi: "JavaScript trong trình duyệt không dùng args",
    en: "In-browser JavaScript does not take arguments",
  },
  argsUnsupported: {
    vi: "Engine hiện tại không hỗ trợ args cho ngôn ngữ này",
    en: "The current engine does not support arguments for this language",
  },
  argsHint: {
    vi: "Cách nhau bởi khoảng trắng; dùng nháy kép cho giá trị có khoảng trắng.",
    en: "Space-separated; quote values that contain spaces.",
  },
  metricTime: { vi: "Tổng thời gian thực thi", en: "Total execution time" },
  metricCpu: { vi: "Thời gian CPU", en: "CPU time" },
  metricMemory: { vi: "Bộ nhớ đỉnh", en: "Peak memory" },
  metricOutput: { vi: "Kích thước output (stdout + stderr)", en: "Output size (stdout + stderr)" },
  outputEmpty: {
    vi: "Nhấn “Chạy code” để xem kết quả tại đây.",
    en: "Press “Run code” to see the result here.",
  },
  copyOutput: { vi: "Sao chép output", en: "Copy output" },
  running: { vi: "Đang chạy…", en: "Running…" },
  noOutput: { vi: "(không có output)", en: "(no output)" },
  snippetLoaded: { vi: "Đã tải snippet được chia sẻ.", en: "Loaded the shared snippet." },
  snippetFailed: {
    vi: "Không tải được snippet (đã hết hạn hoặc sai link).",
    en: "Could not load the snippet (expired or invalid link).",
  },
  execFailed: {
    vi: "Không kết nối được máy chủ thực thi. Vui lòng thử lại.",
    en: "Could not reach the execution server. Please try again.",
  },
  shareFailed: { vi: "Không chia sẻ được snippet.", en: "Could not share the snippet." },
  shareCopied: { vi: "Đã sao chép link chia sẻ:", en: "Share link copied:" },
  serverError: { vi: "Lỗi máy chủ", en: "Server error" },
  completionHint: {
    vi: "Gợi ý code kiểu IntelliJ: gõ để hiện popup, Ctrl+Space gọi thủ công. Smart thêm live template (sout, psvm, fori…), API phổ biến và gợi ý sau dấu chấm.",
    en: "IntelliJ-style completion: popup while typing, Ctrl+Space to invoke. Smart adds live templates (sout, psvm, fori…), common APIs and member suggestions after a dot.",
  },
} satisfies Record<string, Localized>;

interface RuntimeInfo {
  language: SupportedLanguage;
  version: string;
  label?: string;
}

interface OutputLine {
  kind: "stdout" | "stderr" | "meta";
  text: string;
}

const LANGUAGES: SupportedLanguage[] = ["java", "python", "javascript"];
const COMPLETION_STORAGE_KEY = "devtility.editor.completion";

/** Until /api/execute/runtimes responds, assume the default engine (Wandbox: args = Python only). */
const DEFAULT_CAPABILITIES: ProviderCapabilities = {
  name: "wandbox",
  argsLanguages: ["python"],
  reportsResourceUsage: false,
};

function languageExtension(language: SupportedLanguage) {
  switch (language) {
    case "java":
      return java();
    case "python":
      return python();
    case "javascript":
      return javascript();
  }
}

function stageToLines(stage: StageResult | undefined, prefix: string): OutputLine[] {
  if (!stage) return [];
  const lines: OutputLine[] = [];
  if (stage.stdout) lines.push({ kind: "stdout", text: stage.stdout.replace(/\n$/, "") });
  if (stage.stderr) lines.push({ kind: "stderr", text: `${prefix}${stage.stderr.replace(/\n$/, "")}` });
  return lines;
}

function initialCompletionMode(): CompletionMode {
  // Client-only component (ssr: false) — safe to read localStorage in the initializer
  try {
    const stored = window.localStorage.getItem(COMPLETION_STORAGE_KEY);
    if (stored === "off" || stored === "basic" || stored === "smart") return stored;
  } catch {
    // ignore
  }
  return "smart";
}

export default function CodeEditorTool() {
  const { resolvedTheme } = useTheme();
  const { t, lang } = useI18n();
  const [language, setLanguage] = useState<SupportedLanguage>("java");
  const [codeByLanguage, setCodeByLanguage] = useState<Record<SupportedLanguage, string>>({ ...SAMPLES });
  const [runtimes, setRuntimes] = useState<RuntimeInfo[]>([]);
  const [version, setVersion] = useState<string>("*");
  const [completionMode, setCompletionMode] = useState<CompletionMode>(initialCompletionMode);
  const [stdin, setStdin] = useState("");
  const [argsInput, setArgsInput] = useState("");
  const [capabilities, setCapabilities] = useState<ProviderCapabilities>(DEFAULT_CAPABILITIES);
  const [metrics, setMetrics] = useState<RunMetrics | null>(null);
  const [output, setOutput] = useState<OutputLine[]>([]);
  const [running, setRunning] = useState(false);
  const [shareState, setShareState] = useState<"idle" | "saving" | "done" | "error">("idle");
  const [shareMessage, setShareMessage] = useState<string | null>(null);
  const outputRef = useRef<HTMLDivElement>(null);

  const code = codeByLanguage[language];

  const editorExtensions = useMemo(
    () => [languageExtension(language), ...completionExtensions(language, completionMode)],
    [language, completionMode],
  );

  const changeCompletionMode = (mode: CompletionMode) => {
    setCompletionMode(mode);
    try {
      window.localStorage.setItem(COMPLETION_STORAGE_KEY, mode);
    } catch {
      // ignore
    }
  };

  // ---- available runtimes + engine capabilities (server execution) ----
  useEffect(() => {
    fetch("/api/execute/runtimes")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((data: { runtimes: RuntimeInfo[]; capabilities?: ProviderCapabilities }) => {
        setRuntimes(data.runtimes);
        if (data.capabilities) setCapabilities(data.capabilities);
      })
      .catch(() => setRuntimes([]));
  }, []);

  // ---- load shared snippet from ?snippet=<id> ----
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("snippet");
    if (!id) return;
    fetch(`/api/snippets/${encodeURIComponent(id)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((snippet: { language: string; code: string }) => {
        const snippetLang = LANGUAGES.includes(snippet.language as SupportedLanguage)
          ? (snippet.language as SupportedLanguage)
          : "javascript";
        setLanguage(snippetLang);
        setCodeByLanguage((prev) => ({ ...prev, [snippetLang]: snippet.code }));
        setOutput([{ kind: "meta", text: t(M.snippetLoaded) }]);
      })
      .catch(() => setOutput([{ kind: "meta", text: t(M.snippetFailed) }]));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one-shot on mount; message language fixed at load time
  }, []);

  const versionsForLanguage = useMemo(
    () => runtimes.filter((r) => r.language === language),
    [runtimes, language],
  );

  // Derived: fall back to the first available runtime when the stored choice
  // doesn't belong to the current language (no effect needed).
  const effectiveVersion = versionsForLanguage.some((r) => r.version === version)
    ? version
    : (versionsForLanguage[0]?.version ?? "*");

  // Whether the current language accepts command-line args (browser JS never does)
  const argsSupported = language !== "javascript" && capabilities.argsLanguages.includes(language);

  const run = async () => {
    setRunning(true);
    setMetrics(null);
    setOutput([{ kind: "meta", text: t(M.running) }]);
    try {
      if (language === "javascript") {
        const result = await runJavaScriptInBrowser(code);
        const lines: OutputLine[] = result.logs.map((l) => ({
          kind: l.type === "error" || l.type === "warn" ? "stderr" : "stdout",
          text: l.text,
        }));
        if (result.error) lines.push({ kind: "stderr", text: result.error });
        if (lines.length === 0) lines.push({ kind: "meta", text: t(M.noOutput) });
        setOutput(lines);
        setMetrics({
          durationMs: result.durationMs,
          cpuTimeMs: null,
          memoryBytes: null,
          outputBytes: utf8Bytes(result.logs.map((l) => l.text).join("\n") + (result.error ?? "")),
          exitCode: null,
          signal: null,
          runtimeLabel: lang === "vi" ? "JavaScript (trình duyệt)" : "JavaScript (browser)",
        });
      } else {
        const res = await fetch("/api/execute", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            language,
            version: effectiveVersion,
            code,
            stdin,
            args: argsSupported ? parseArgs(argsInput) : [],
          }),
        });
        const data = (await res.json()) as {
          error?: string;
          run?: StageResult;
          compile?: StageResult;
          version?: string;
          durationMs?: number;
        };
        if (!res.ok || !data.run) {
          setOutput([{ kind: "stderr", text: data.error ?? `${t(M.serverError)} (${res.status})` }]);
        } else {
          const lines = [
            ...stageToLines(data.compile, "[compile] "),
            ...stageToLines(data.run, ""),
          ];
          if (lines.length === 0) lines.push({ kind: "meta", text: t(M.noOutput) });
          setOutput(lines);
          const resolvedVersion = data.version ?? effectiveVersion;
          const runtimeLabel =
            versionsForLanguage.find((r) => r.version === resolvedVersion)?.label ??
            `${LANGUAGE_LABELS[language]} ${resolvedVersion}`;
          setMetrics({
            // Engine-reported wall time is the pure run; the measured fallback includes engine queue/network
            durationMs: data.run.wallTimeMs ?? data.durationMs ?? null,
            cpuTimeMs: data.run.cpuTimeMs ?? null,
            memoryBytes: data.run.memoryBytes ?? null,
            outputBytes: utf8Bytes(data.run.stdout + data.run.stderr),
            exitCode: data.run.code,
            signal: data.run.signal,
            runtimeLabel,
          });
        }
      }
    } catch {
      setOutput([{ kind: "stderr", text: t(M.execFailed) }]);
    } finally {
      setRunning(false);
      outputRef.current?.scrollTo({ top: 0 });
    }
  };

  const share = async () => {
    setShareState("saving");
    setShareMessage(null);
    try {
      const res = await fetch("/api/snippets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ language, version: effectiveVersion, code }),
      });
      const data = (await res.json()) as { id?: string; error?: string };
      if (!res.ok || !data.id) {
        setShareState("error");
        setShareMessage(data.error ?? t(M.shareFailed));
        return;
      }
      const url = `${window.location.origin}${window.location.pathname}?snippet=${data.id}`;
      await navigator.clipboard.writeText(url).catch(() => undefined);
      setShareState("done");
      setShareMessage(`${t(M.shareCopied)} ${url}`);
    } catch {
      setShareState("error");
      setShareMessage(t(M.shareFailed));
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
        {/* ---- Editor ---- */}
        <Card className="min-w-0">
          <CardHeader
            title={t(M.editorTitle)}
            subtitle={language === "javascript" ? t(M.subtitleJs) : t(M.subtitleServer)}
            actions={
              <div className="flex flex-wrap items-center gap-2">
                <Select
                  aria-label={t(M.completionAria)}
                  title={t(M.completionHint)}
                  className="h-8 w-40 text-xs"
                  value={completionMode}
                  onChange={(e) => changeCompletionMode(e.target.value as CompletionMode)}
                >
                  <option value="off">{t(M.completionOff)}</option>
                  <option value="basic">{t(M.completionBasic)}</option>
                  <option value="smart">{t(M.completionSmart)}</option>
                </Select>
                <Select
                  aria-label={t(M.languageAria)}
                  className="h-8 w-36 text-xs"
                  value={language}
                  onChange={(e) => setLanguage(e.target.value as SupportedLanguage)}
                >
                  {LANGUAGES.map((l) => (
                    <option key={l} value={l}>
                      {LANGUAGE_LABELS[l]}
                    </option>
                  ))}
                </Select>
                {language !== "javascript" ? (
                  <Select
                    aria-label={t(M.versionAria)}
                    className="h-8 w-28 text-xs"
                    value={effectiveVersion}
                    onChange={(e) => setVersion(e.target.value)}
                    disabled={versionsForLanguage.length === 0}
                  >
                    {versionsForLanguage.length === 0 ? (
                      <option value="*">latest</option>
                    ) : (
                      versionsForLanguage.map((r) => (
                        <option key={r.version} value={r.version}>
                          {r.label ?? r.version}
                        </option>
                      ))
                    )}
                  </Select>
                ) : null}
              </div>
            }
          />
          <CardBody className="px-0 py-0">
            <CodeMirror
              value={code}
              onChange={(value) =>
                setCodeByLanguage((prev) => (prev[language] === value ? prev : { ...prev, [language]: value }))
              }
              extensions={editorExtensions}
              theme={resolvedTheme === "dark" ? vscodeDark : vscodeLight}
              height="420px"
              basicSetup={{
                tabSize: language === "python" ? 4 : 2,
                autocompletion: false,
                completionKeymap: false,
              }}
              aria-label={t(M.editorAria)}
            />
            <div className="flex flex-wrap items-center gap-2 border-t border-border px-4 py-3">
              <Button onClick={run} disabled={running} size="md">
                {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                {t(M.run)}
              </Button>
              <Button
                variant="outline"
                onClick={() => setCodeByLanguage((prev) => ({ ...prev, [language]: SAMPLES[language] }))}
              >
                <RotateCcw className="h-4 w-4" />
                {t(M.sample)}
              </Button>
              <Button variant="outline" onClick={share} disabled={shareState === "saving"}>
                {shareState === "saving" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Share2 className="h-4 w-4" />
                )}
                {t(M.share)}
              </Button>
              <div className="ml-auto">
                <CopyButton text={code} label={t(M.copyCode)} />
              </div>
            </div>
            {shareMessage ? (
              <p
                className={cn(
                  "break-all border-t border-border px-4 py-2 text-xs",
                  shareState === "error" ? "text-danger" : "text-success",
                )}
              >
                {shareMessage}
              </p>
            ) : null}
          </CardBody>
        </Card>

        {/* ---- Stdin + Output ---- */}
        <div className="flex min-w-0 flex-col gap-4">
          <Card>
            <CardBody className="space-y-4">
              <div>
                <Label htmlFor="editor-stdin">{t(M.stdinLabel)}</Label>
                <TextArea
                  id="editor-stdin"
                  rows={3}
                  value={stdin}
                  onChange={(e) => setStdin(e.target.value)}
                  placeholder={language === "javascript" ? t(M.stdinPlaceholderJs) : t(M.stdinPlaceholder)}
                  disabled={language === "javascript"}
                />
              </div>
              <div>
                <Label htmlFor="editor-args">{t(M.argsLabel)}</Label>
                <TextInput
                  id="editor-args"
                  className="font-mono text-sm"
                  value={argsInput}
                  onChange={(e) => setArgsInput(e.target.value)}
                  placeholder={
                    language === "javascript"
                      ? t(M.argsPlaceholderJs)
                      : argsSupported
                        ? t(M.argsPlaceholder)
                        : t(M.argsUnsupported)
                  }
                  title={argsSupported ? t(M.argsHint) : undefined}
                  disabled={!argsSupported}
                />
                {argsSupported ? (
                  <p className="mt-1 text-xs text-muted-foreground">{t(M.argsHint)}</p>
                ) : null}
              </div>
            </CardBody>
          </Card>

          <Card className="flex-1">
            <CardHeader
              title={
                <span className="inline-flex items-center gap-2">
                  <Terminal className="h-4 w-4 text-accent" /> Output
                </span>
              }
              actions={
                output.length > 0 ? (
                  <CopyButton text={output.map((l) => l.text).join("\n")} label={t(M.copyOutput)} />
                ) : undefined
              }
            />
            <CardBody className="px-0 py-0">
              {metrics ? (
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-border px-4 py-2 font-mono text-[11px] text-muted-foreground">
                  {metrics.durationMs !== null ? (
                    <span className="inline-flex items-center gap-1" title={t(M.metricTime)}>
                      <Timer className="h-3.5 w-3.5" aria-hidden />
                      {formatDuration(metrics.durationMs)}
                    </span>
                  ) : null}
                  {metrics.cpuTimeMs !== null ? (
                    <span className="inline-flex items-center gap-1" title={t(M.metricCpu)}>
                      <Cpu className="h-3.5 w-3.5" aria-hidden />
                      {formatDuration(metrics.cpuTimeMs)}
                    </span>
                  ) : null}
                  {metrics.memoryBytes !== null ? (
                    <span className="inline-flex items-center gap-1" title={t(M.metricMemory)}>
                      <MemoryStick className="h-3.5 w-3.5" aria-hidden />
                      {formatBytes(metrics.memoryBytes)}
                    </span>
                  ) : null}
                  <span className="inline-flex items-center gap-1" title={t(M.metricOutput)}>
                    <FileText className="h-3.5 w-3.5" aria-hidden />
                    {formatBytes(metrics.outputBytes)}
                  </span>
                  {metrics.signal ? (
                    <span className="text-danger">{metrics.signal}</span>
                  ) : metrics.exitCode !== null ? (
                    <span className={metrics.exitCode === 0 ? "text-success" : "text-danger"}>
                      exit {metrics.exitCode}
                    </span>
                  ) : null}
                  <span className="ml-auto truncate">{metrics.runtimeLabel}</span>
                </div>
              ) : null}
              <div
                ref={outputRef}
                className="h-[320px] overflow-auto whitespace-pre-wrap break-words px-4 py-3 font-mono text-xs leading-relaxed"
                role="log"
                aria-live="polite"
              >
                {output.length === 0 ? (
                  <span className="text-muted-foreground">{t(M.outputEmpty)}</span>
                ) : (
                  output.map((line, i) => (
                    <div
                      key={i}
                      className={cn(
                        line.kind === "stderr" && "text-danger",
                        line.kind === "meta" && "mt-1 text-muted-foreground",
                      )}
                    >
                      {line.text}
                    </div>
                  ))
                )}
              </div>
            </CardBody>
          </Card>
        </div>
      </div>

    </div>
  );
}
