"use client";

import { java } from "@codemirror/lang-java";
import { javascript } from "@codemirror/lang-javascript";
import { python } from "@codemirror/lang-python";
import { vscodeDark, vscodeLight } from "@uiw/codemirror-theme-vscode";
import CodeMirror from "@uiw/react-codemirror";
import { Loader2, Play, RotateCcw, Share2, Terminal } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { CopyButton } from "@/components/ui/copy-button";
import { Label, Select, TextArea } from "@/components/ui/field";
import type { StageResult, SupportedLanguage } from "@/server/execute/types";
import { cn } from "@/lib/utils";

import { runJavaScriptInBrowser } from "./run-js-in-browser";
import { LANGUAGE_LABELS, SAMPLES } from "./samples";

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

export default function CodeEditorTool() {
  const { resolvedTheme } = useTheme();
  const [language, setLanguage] = useState<SupportedLanguage>("java");
  const [codeByLanguage, setCodeByLanguage] = useState<Record<SupportedLanguage, string>>({ ...SAMPLES });
  const [runtimes, setRuntimes] = useState<RuntimeInfo[]>([]);
  const [version, setVersion] = useState<string>("*");
  const [stdin, setStdin] = useState("");
  const [output, setOutput] = useState<OutputLine[]>([]);
  const [running, setRunning] = useState(false);
  const [shareState, setShareState] = useState<"idle" | "saving" | "done" | "error">("idle");
  const [shareMessage, setShareMessage] = useState<string | null>(null);
  const outputRef = useRef<HTMLDivElement>(null);

  const code = codeByLanguage[language];

  // ---- available runtimes (server execution) ----
  useEffect(() => {
    fetch("/api/execute/runtimes")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((data: { runtimes: RuntimeInfo[] }) => setRuntimes(data.runtimes))
      .catch(() => setRuntimes([]));
  }, []);

  // ---- load shared snippet from ?snippet=<id> ----
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("snippet");
    if (!id) return;
    fetch(`/api/snippets/${encodeURIComponent(id)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((snippet: { language: string; code: string }) => {
        const lang = LANGUAGES.includes(snippet.language as SupportedLanguage)
          ? (snippet.language as SupportedLanguage)
          : "javascript";
        setLanguage(lang);
        setCodeByLanguage((prev) => ({ ...prev, [lang]: snippet.code }));
        setOutput([{ kind: "meta", text: "Đã tải snippet được chia sẻ." }]);
      })
      .catch(() => setOutput([{ kind: "meta", text: "Không tải được snippet (đã hết hạn hoặc sai link)." }]));
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

  const run = async () => {
    setRunning(true);
    setOutput([{ kind: "meta", text: "Đang chạy…" }]);
    try {
      if (language === "javascript") {
        const result = await runJavaScriptInBrowser(code);
        const lines: OutputLine[] = result.logs.map((l) => ({
          kind: l.type === "error" || l.type === "warn" ? "stderr" : "stdout",
          text: l.text,
        }));
        if (result.error) lines.push({ kind: "stderr", text: result.error });
        lines.push({ kind: "meta", text: `Hoàn tất trong ${result.durationMs}ms (chạy trong trình duyệt)` });
        setOutput(lines);
      } else {
        const res = await fetch("/api/execute", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ language, version: effectiveVersion, code, stdin }),
        });
        const data = (await res.json()) as {
          error?: string;
          run?: StageResult;
          compile?: StageResult;
          version?: string;
        };
        if (!res.ok || !data.run) {
          setOutput([{ kind: "stderr", text: data.error ?? `Lỗi máy chủ (${res.status})` }]);
        } else {
          const lines = [
            ...stageToLines(data.compile, "[compile] "),
            ...stageToLines(data.run, ""),
          ];
          if (lines.length === 0) lines.push({ kind: "meta", text: "(không có output)" });
          lines.push({
            kind: "meta",
            text: `Exit code: ${data.run.code ?? "?"} · ${LANGUAGE_LABELS[language]} ${data.version ?? effectiveVersion}`,
          });
          setOutput(lines);
        }
      }
    } catch {
      setOutput([{ kind: "stderr", text: "Không kết nối được máy chủ thực thi. Vui lòng thử lại." }]);
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
        setShareMessage(data.error ?? "Không chia sẻ được snippet.");
        return;
      }
      const url = `${window.location.origin}${window.location.pathname}?snippet=${data.id}`;
      await navigator.clipboard.writeText(url).catch(() => undefined);
      setShareState("done");
      setShareMessage(`Đã sao chép link chia sẻ: ${url}`);
    } catch {
      setShareState("error");
      setShareMessage("Không chia sẻ được snippet.");
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
        {/* ---- Editor ---- */}
        <Card className="min-w-0">
          <CardHeader
            title="Trình soạn thảo"
            subtitle={
              language === "javascript"
                ? "JavaScript chạy trực tiếp trong trình duyệt của bạn (Web Worker sandbox)"
                : "Java & Python chạy trên server (engine Wandbox — miễn phí, không cần key)"
            }
            actions={
              <div className="flex flex-wrap items-center gap-2">
                <Select
                  aria-label="Ngôn ngữ"
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
                    aria-label="Phiên bản"
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
              extensions={[languageExtension(language)]}
              theme={resolvedTheme === "dark" ? vscodeDark : vscodeLight}
              height="420px"
              basicSetup={{ tabSize: language === "python" ? 4 : 2 }}
              aria-label="Vùng soạn thảo code"
            />
            <div className="flex flex-wrap items-center gap-2 border-t border-border px-4 py-3">
              <Button onClick={run} disabled={running} size="md">
                {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                Chạy code
              </Button>
              <Button
                variant="outline"
                onClick={() => setCodeByLanguage((prev) => ({ ...prev, [language]: SAMPLES[language] }))}
              >
                <RotateCcw className="h-4 w-4" />
                Code mẫu
              </Button>
              <Button variant="outline" onClick={share} disabled={shareState === "saving"}>
                {shareState === "saving" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Share2 className="h-4 w-4" />
                )}
                Chia sẻ
              </Button>
              <div className="ml-auto">
                <CopyButton text={code} label="Sao chép code" />
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
            <CardBody>
              <Label htmlFor="editor-stdin">Stdin (đầu vào chương trình)</Label>
              <TextArea
                id="editor-stdin"
                rows={3}
                value={stdin}
                onChange={(e) => setStdin(e.target.value)}
                placeholder={
                  language === "javascript" ? "JavaScript trong trình duyệt không dùng stdin" : "Mỗi dòng một giá trị…"
                }
                disabled={language === "javascript"}
              />
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
                  <CopyButton text={output.map((l) => l.text).join("\n")} label="Sao chép output" />
                ) : undefined
              }
            />
            <CardBody className="px-0 py-0">
              <div
                ref={outputRef}
                className="h-[320px] overflow-auto whitespace-pre-wrap break-words px-4 py-3 font-mono text-xs leading-relaxed"
                role="log"
                aria-live="polite"
              >
                {output.length === 0 ? (
                  <span className="text-muted-foreground">Nhấn “Chạy code” để xem kết quả tại đây.</span>
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

      <p className="text-xs text-muted-foreground">
        Engine mặc định: Wandbox (OpenJDK 21/22, CPython 3.7–3.14). Với Java, class{" "}
        <code className="font-mono">public</code> ở cấp cao nhất được tự chuyển thành package-private để chạy dạng
        1 file — kết quả không đổi. Muốn đầy đủ Java 8–25: tự host Piston và trỏ{" "}
        <code className="font-mono">EXECUTE_API_URL</code> — xem DEPLOYMENT.md.
      </p>
    </div>
  );
}
