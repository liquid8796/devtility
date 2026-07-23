"use client";

import { diffChars, diffLines, diffWordsWithSpace, type ChangeObject } from "diff";
import { Check, CircleCheck, GitCompare, Info } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";

import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Field, Select, TextArea } from "@/components/ui/field";
import { Tabs } from "@/components/ui/tabs";
import type { Localized } from "@/lib/i18n";
import { useI18n } from "@/lib/i18n/use-lang";
import { cn } from "@/lib/utils";

import { displayPath, jsonDiff, type DiffKind, type JsonDiffResult } from "./json-diff";

const LARGE_LIMIT = 200_000;
const ROW_CAP = 3000;
const DIFF_TIMEOUT_MS = 2000;

const M = {
  modeText: { vi: "So sánh văn bản", en: "Text diff" },
  modeJson: { vi: "So sánh JSON", en: "JSON semantic diff" },
  original: { vi: "Bản gốc", en: "Original" },
  changed: { vi: "Bản mới", en: "Changed" },
  textTitle: { vi: "So sánh văn bản", en: "Text diff" },
  textSubtitle: {
    vi: "Dán hai đoạn văn bản để xem khác biệt",
    en: "Paste two texts to see the differences",
  },
  jsonTitle: { vi: "So sánh JSON ngữ nghĩa", en: "JSON semantic diff" },
  jsonSubtitle: {
    vi: "So sánh theo cấu trúc, không phụ thuộc định dạng",
    en: "Structural comparison, independent of formatting",
  },
  ignoreWhitespace: { vi: "Bỏ qua whitespace", en: "Ignore whitespace" },
  ignoreWhitespaceLineOnly: {
    vi: "Chỉ áp dụng khi so sánh theo dòng",
    en: "Only applies to line granularity",
  },
  ignoreCase: { vi: "Bỏ qua hoa thường", en: "Ignore case" },
  ignoreKeyOrder: { vi: "Bỏ qua thứ tự key", en: "Ignore key order" },
  ignoreKeyOrderHint: {
    vi: "Tắt để báo cả khác biệt thứ tự key",
    en: "Turn off to also flag key-order differences",
  },
  jsonWhitespaceInherent: {
    vi: "JSON được phân tích cú pháp nên whitespace luôn được bỏ qua",
    en: "JSON is parsed, so whitespace is always ignored",
  },
  granularity: { vi: "Mức so sánh", en: "Granularity" },
  granLine: { vi: "Dòng", en: "Line" },
  granWord: { vi: "Từ", en: "Word" },
  granChar: { vi: "Ký tự", en: "Character" },
  emptyTextHint: {
    vi: "Nhập văn bản vào hai ô để so sánh.",
    en: "Enter text on both sides to compare.",
  },
  emptyJsonHint: {
    vi: "Nhập JSON vào hai ô để so sánh.",
    en: "Enter JSON on both sides to compare.",
  },
  identical: { vi: "Hai văn bản giống nhau", en: "Texts are identical" },
  largeInput: {
    vi: "Dữ liệu vượt 200.000 ký tự — chỉ hỗ trợ so sánh theo dòng.",
    en: "Input exceeds 200,000 characters — only line mode is attempted.",
  },
  diffAborted: {
    vi: "Phép so sánh quá phức tạp và đã bị dừng để tránh treo trình duyệt.",
    en: "The diff was too complex and was aborted to keep the browser responsive.",
  },
  rowCapNotice: {
    vi: `Chỉ hiển thị ${ROW_CAP} dòng đầu tiên.`,
    en: `Only the first ${ROW_CAP} lines are shown.`,
  },
  parseErrorPrefix: { vi: "lỗi cú pháp JSON —", en: "invalid JSON —" },
  jsonEqual: {
    vi: "Hai JSON tương đương",
    en: "JSONs are semantically equal",
  },
  arrayNote: {
    vi: "Mảng được so sánh theo từng chỉ số (index), không dò phần tử bị dịch chuyển.",
    en: "Arrays are compared index-by-index; shifted elements are not detected.",
  },
  entryCapNotice: {
    vi: "Danh sách khác biệt đã bị cắt bớt để hiển thị.",
    en: "The difference list was truncated for display.",
  },
  kindHeader: { vi: "Loại", en: "Kind" },
  pathHeader: { vi: "Đường dẫn", en: "Path" },
  valueHeader: { vi: "Giá trị (gốc → mới)", en: "Value (original → changed)" },
} satisfies Record<string, Localized>;

const KIND_LABEL = {
  added: { vi: "thêm", en: "added" },
  removed: { vi: "xóa", en: "removed" },
  changed: { vi: "đổi", en: "changed" },
  type: { vi: "kiểu", en: "type" },
  order: { vi: "thứ tự", en: "order" },
} satisfies Record<DiffKind, Localized>;

const KIND_STYLE: Record<DiffKind, string> = {
  added: "bg-success/10 text-success",
  removed: "bg-danger/10 text-danger",
  changed: "bg-warning/10 text-warning",
  type: "bg-accent/20 text-accent",
  order: "bg-primary/10 text-primary",
};

type Granularity = "line" | "word" | "char";

function useDebouncedValue<T>(value: T, delay = 250): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

function OptionChip({
  label,
  checked,
  onToggle,
  disabled,
  title,
}: {
  label: string;
  checked: boolean;
  onToggle?: () => void;
  disabled?: boolean;
  title?: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={checked}
      disabled={disabled}
      title={title}
      onClick={onToggle}
      className={cn(
        "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-medium transition-colors",
        checked
          ? "border-primary/40 bg-primary/10 text-primary"
          : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground",
        disabled && "cursor-not-allowed opacity-60 hover:border-border hover:text-muted-foreground",
        disabled && checked && "hover:border-primary/40 hover:text-primary",
      )}
    >
      <span
        className={cn(
          "flex h-3.5 w-3.5 items-center justify-center rounded-sm border",
          checked ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card",
        )}
        aria-hidden
      >
        {checked ? <Check className="h-2.5 w-2.5" /> : null}
      </span>
      {label}
    </button>
  );
}

function StatBadges({ added, removed }: { added: number; removed: number }) {
  return (
    <span className="font-mono text-xs font-semibold">
      <span className="text-success">+{added}</span>{" "}
      <span className="text-danger">−{removed}</span>
    </span>
  );
}

function Notice({ tone, children }: { tone: "muted" | "warning" | "danger" | "success"; children: ReactNode }) {
  const tones = {
    muted: "bg-muted text-muted-foreground",
    warning: "bg-warning/10 text-warning",
    danger: "bg-danger/10 text-danger",
    success: "bg-success/10 text-success",
  } as const;
  return <p className={cn("rounded-lg px-3 py-2 text-xs", tones[tone])}>{children}</p>;
}

// ---------------------------------------------------------------------------
// Text diff
// ---------------------------------------------------------------------------

interface LineRow {
  sign: "+" | "-" | " ";
  text: string;
}

/** Split into diffLines-compatible lines (trailing newline does not add a line). */
function splitLines(text: string): string[] {
  const lines = text.split("\n");
  if (lines.length > 1 && lines[lines.length - 1] === "") lines.pop();
  return lines;
}

interface LineDiffOutcome {
  kind: "lines";
  rows: LineRow[];
  added: number;
  removed: number;
  truncated: boolean;
}

interface InlineDiffOutcome {
  kind: "inline";
  parts: ChangeObject<string>[];
  added: number;
  removed: number;
}

type TextDiffOutcome = LineDiffOutcome | InlineDiffOutcome | { kind: "aborted" };

function computeLineDiff(
  left: string,
  right: string,
  ignoreWhitespace: boolean,
  ignoreCase: boolean,
): TextDiffOutcome {
  const changes = diffLines(
    ignoreCase ? left.toLowerCase() : left,
    ignoreCase ? right.toLowerCase() : right,
    { ignoreWhitespace, timeout: DIFF_TIMEOUT_MS },
  );
  if (changes === undefined) return { kind: "aborted" };

  // Map back to the original (non-lowercased) lines via token counts.
  const leftLines = splitLines(left);
  const rightLines = splitLines(right);
  const rows: LineRow[] = [];
  let li = 0;
  let ri = 0;
  let added = 0;
  let removed = 0;
  let truncated = false;

  for (const change of changes) {
    const count = change.count;
    if (change.added) added += count;
    else if (change.removed) removed += count;
    for (let i = 0; i < count; i++) {
      if (rows.length >= ROW_CAP) {
        truncated = true;
      }
      if (change.added) {
        if (!truncated) rows.push({ sign: "+", text: rightLines[ri] ?? "" });
        ri++;
      } else if (change.removed) {
        if (!truncated) rows.push({ sign: "-", text: leftLines[li] ?? "" });
        li++;
      } else {
        if (!truncated) rows.push({ sign: " ", text: rightLines[ri] ?? "" });
        li++;
        ri++;
      }
    }
  }
  return { kind: "lines", rows, added, removed, truncated };
}

function computeTextDiff(
  left: string,
  right: string,
  granularity: Granularity,
  ignoreWhitespace: boolean,
  ignoreCase: boolean,
): TextDiffOutcome {
  try {
    if (granularity === "line") {
      return computeLineDiff(left, right, ignoreWhitespace, ignoreCase);
    }
    const parts =
      granularity === "word"
        ? diffWordsWithSpace(left, right, { ignoreCase, timeout: DIFF_TIMEOUT_MS })
        : diffChars(left, right, { ignoreCase, timeout: DIFF_TIMEOUT_MS });
    if (parts === undefined) return { kind: "aborted" };
    const added = parts.filter((p) => p.added).length;
    const removed = parts.filter((p) => p.removed).length;
    return { kind: "inline", parts, added, removed };
  } catch {
    return { kind: "aborted" };
  }
}

function TextDiffSection() {
  const { t } = useI18n();
  const [left, setLeft] = useState("");
  const [right, setRight] = useState("");
  const [granularity, setGranularity] = useState<Granularity>("line");
  const [ignoreWhitespace, setIgnoreWhitespace] = useState(false);
  const [ignoreCase, setIgnoreCase] = useState(false);

  const debLeft = useDebouncedValue(left);
  const debRight = useDebouncedValue(right);

  const isLarge = debLeft.length + debRight.length > LARGE_LIMIT;
  const effectiveGranularity: Granularity = isLarge ? "line" : granularity;
  const bothEmpty = debLeft === "" && debRight === "";

  const outcome = useMemo((): TextDiffOutcome | null => {
    if (bothEmpty) return null;
    return computeTextDiff(debLeft, debRight, effectiveGranularity, ignoreWhitespace, ignoreCase);
  }, [bothEmpty, debLeft, debRight, effectiveGranularity, ignoreWhitespace, ignoreCase]);

  const identical =
    outcome !== null && outcome.kind !== "aborted" && outcome.added === 0 && outcome.removed === 0;

  return (
    <Card className="animate-fade-up">
      <CardHeader
        title={t(M.textTitle)}
        subtitle={t(M.textSubtitle)}
        actions={
          outcome !== null && outcome.kind !== "aborted" && !identical ? (
            <StatBadges added={outcome.added} removed={outcome.removed} />
          ) : undefined
        }
      />
      <CardBody className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label={t(M.original)} htmlFor="diff-text-left">
            <TextArea
              id="diff-text-left"
              className="min-h-40"
              spellCheck={false}
              placeholder="v1…"
              value={left}
              onChange={(e) => setLeft(e.target.value)}
            />
          </Field>
          <Field label={t(M.changed)} htmlFor="diff-text-right">
            <TextArea
              id="diff-text-right"
              className="min-h-40"
              spellCheck={false}
              placeholder="v2…"
              value={right}
              onChange={(e) => setRight(e.target.value)}
            />
          </Field>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <OptionChip
            label={t(M.ignoreWhitespace)}
            checked={ignoreWhitespace}
            onToggle={() => setIgnoreWhitespace((v) => !v)}
            disabled={effectiveGranularity !== "line"}
            title={t(M.ignoreWhitespaceLineOnly)}
          />
          <OptionChip
            label={t(M.ignoreCase)}
            checked={ignoreCase}
            onToggle={() => setIgnoreCase((v) => !v)}
          />
          <div className="ml-auto w-40">
            <Select
              aria-label={t(M.granularity)}
              className="h-8 text-xs"
              value={granularity}
              onChange={(e) => setGranularity(e.target.value as Granularity)}
            >
              <option value="line">{t(M.granLine)}</option>
              <option value="word">{t(M.granWord)}</option>
              <option value="char">{t(M.granChar)}</option>
            </Select>
          </div>
        </div>

        {isLarge ? <Notice tone="warning">{t(M.largeInput)}</Notice> : null}

        {outcome === null ? (
          <p className="rounded-lg bg-muted px-4 py-4 text-center text-sm text-muted-foreground">
            {t(M.emptyTextHint)}
          </p>
        ) : outcome.kind === "aborted" ? (
          <Notice tone="danger">{t(M.diffAborted)}</Notice>
        ) : identical ? (
          <div className="flex items-center justify-center gap-2 rounded-xl bg-success/10 px-4 py-6 text-sm font-medium text-success">
            <CircleCheck className="h-5 w-5 shrink-0" aria-hidden />
            {t(M.identical)}
          </div>
        ) : outcome.kind === "lines" ? (
          <div className="space-y-2">
            {outcome.truncated ? <Notice tone="warning">{t(M.rowCapNotice)}</Notice> : null}
            <pre className="max-h-[32rem] overflow-y-auto rounded-lg border border-border bg-muted/50 py-1 font-mono text-xs leading-relaxed">
              {outcome.rows.map((row, i) => (
                <div
                  key={i}
                  className={cn(
                    "flex px-3",
                    row.sign === "+" && "bg-success/10 text-success",
                    row.sign === "-" && "bg-danger/10 text-danger",
                  )}
                >
                  <span className="w-5 shrink-0 select-none">{row.sign === " " ? "" : row.sign}</span>
                  <span className="min-w-0 flex-1 whitespace-pre-wrap break-all">
                    {row.text === "" ? " " : row.text}
                  </span>
                </div>
              ))}
            </pre>
          </div>
        ) : (
          <pre className="max-h-[32rem] overflow-y-auto whitespace-pre-wrap break-words rounded-lg border border-border bg-muted/50 px-3 py-2 font-mono text-xs leading-relaxed">
            {outcome.parts.map((part, i) =>
              part.added ? (
                <span key={i} className="rounded-sm bg-success/15 text-success">
                  {part.value}
                </span>
              ) : part.removed ? (
                <span key={i} className="rounded-sm bg-danger/15 text-danger line-through">
                  {part.value}
                </span>
              ) : (
                <span key={i}>{part.value}</span>
              ),
            )}
          </pre>
        )}
      </CardBody>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// JSON diff
// ---------------------------------------------------------------------------

type ParseOutcome = { value: unknown } | { error: string } | null;

function parseJson(raw: string): ParseOutcome {
  if (raw.trim() === "") return null;
  try {
    return { value: JSON.parse(raw) as unknown };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

function previewValue(value: unknown): string | null {
  if (value === undefined) return null;
  const text = JSON.stringify(value) ?? "null";
  return text.length > 120 ? `${text.slice(0, 120)}…` : text;
}

function JsonDiffSection() {
  const { t } = useI18n();
  const [left, setLeft] = useState("");
  const [right, setRight] = useState("");
  const [ignoreKeyOrder, setIgnoreKeyOrder] = useState(true);

  const debLeft = useDebouncedValue(left);
  const debRight = useDebouncedValue(right);

  const parsedLeft = useMemo(() => parseJson(debLeft), [debLeft]);
  const parsedRight = useMemo(() => parseJson(debRight), [debRight]);

  const diff = useMemo((): JsonDiffResult | null => {
    if (parsedLeft === null || parsedRight === null) return null;
    if ("error" in parsedLeft || "error" in parsedRight) return null;
    try {
      return jsonDiff(parsedLeft.value, parsedRight.value, { flagKeyOrder: !ignoreKeyOrder });
    } catch {
      return null;
    }
  }, [parsedLeft, parsedRight, ignoreKeyOrder]);

  const counts = useMemo(() => {
    const byKind: Record<DiffKind, number> = { added: 0, removed: 0, changed: 0, type: 0, order: 0 };
    for (const entry of diff?.entries ?? []) byKind[entry.kind]++;
    return byKind;
  }, [diff]);

  return (
    <Card className="animate-fade-up">
      <CardHeader title={t(M.jsonTitle)} subtitle={t(M.jsonSubtitle)} />
      <CardBody className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label={t(M.original)} htmlFor="diff-json-left">
            <TextArea
              id="diff-json-left"
              className="min-h-40"
              spellCheck={false}
              placeholder='{ "name": "DevTility", "version": 1 }'
              value={left}
              onChange={(e) => setLeft(e.target.value)}
            />
          </Field>
          <Field label={t(M.changed)} htmlFor="diff-json-right">
            <TextArea
              id="diff-json-right"
              className="min-h-40"
              spellCheck={false}
              placeholder='{ "version": 2, "name": "DevTility" }'
              value={right}
              onChange={(e) => setRight(e.target.value)}
            />
          </Field>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <OptionChip
            label={t(M.ignoreKeyOrder)}
            checked={ignoreKeyOrder}
            onToggle={() => setIgnoreKeyOrder((v) => !v)}
            title={t(M.ignoreKeyOrderHint)}
          />
          <OptionChip
            label={t(M.ignoreWhitespace)}
            checked
            disabled
            title={t(M.jsonWhitespaceInherent)}
          />
        </div>

        {parsedLeft !== null && "error" in parsedLeft ? (
          <Notice tone="danger">
            <span className="font-semibold">{t(M.original)}:</span> {t(M.parseErrorPrefix)}{" "}
            <span className="break-all font-mono">{parsedLeft.error}</span>
          </Notice>
        ) : null}
        {parsedRight !== null && "error" in parsedRight ? (
          <Notice tone="danger">
            <span className="font-semibold">{t(M.changed)}:</span> {t(M.parseErrorPrefix)}{" "}
            <span className="break-all font-mono">{parsedRight.error}</span>
          </Notice>
        ) : null}

        {parsedLeft === null || parsedRight === null ? (
          <p className="rounded-lg bg-muted px-4 py-4 text-center text-sm text-muted-foreground">
            {t(M.emptyJsonHint)}
          </p>
        ) : diff === null ? null : diff.entries.length === 0 ? (
          <div className="flex items-center justify-center gap-2 rounded-xl bg-success/10 px-4 py-8 text-base font-semibold text-success">
            <CircleCheck className="h-6 w-6 shrink-0" aria-hidden />
            {t(M.jsonEqual)}
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              {(Object.keys(counts) as DiffKind[])
                .filter((kind) => counts[kind] > 0)
                .map((kind) => (
                  <span
                    key={kind}
                    className={cn(
                      "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium",
                      KIND_STYLE[kind],
                    )}
                  >
                    {counts[kind]} {t(KIND_LABEL[kind])}
                  </span>
                ))}
            </div>
            <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
              {t(M.arrayNote)}
            </p>
            {diff.capped ? <Notice tone="warning">{t(M.entryCapNotice)}</Notice> : null}
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full min-w-[36rem] text-xs">
                <thead>
                  <tr className="border-b border-border bg-muted/60 text-left text-muted-foreground">
                    <th className="px-3 py-2 font-medium">{t(M.kindHeader)}</th>
                    <th className="px-3 py-2 font-medium">{t(M.pathHeader)}</th>
                    <th className="px-3 py-2 font-medium">{t(M.valueHeader)}</th>
                  </tr>
                </thead>
                <tbody>
                  {diff.entries.map((entry, i) => {
                    const leftText = entry.kind === "order" ? String(entry.left) : previewValue(entry.left);
                    const rightText = entry.kind === "order" ? String(entry.right) : previewValue(entry.right);
                    return (
                      <tr key={i} className="border-b border-border/60 last:border-b-0 align-top">
                        <td className="px-3 py-2">
                          <span
                            className={cn(
                              "inline-block rounded-md px-1.5 py-0.5 font-medium",
                              KIND_STYLE[entry.kind],
                            )}
                          >
                            {t(KIND_LABEL[entry.kind])}
                          </span>
                        </td>
                        <td className="max-w-56 break-all px-3 py-2 font-mono">{displayPath(entry.path)}</td>
                        <td className="px-3 py-2 font-mono">
                          {leftText === null ? (
                            <span className="text-muted-foreground">—</span>
                          ) : (
                            <span className="break-all text-danger">{leftText}</span>
                          )}
                          <span className="mx-1.5 text-muted-foreground">→</span>
                          {rightText === null ? (
                            <span className="text-muted-foreground">—</span>
                          ) : (
                            <span className="break-all text-success">{rightText}</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </CardBody>
    </Card>
  );
}

// ---------------------------------------------------------------------------

export default function DiffTool() {
  const { t } = useI18n();
  const [mode, setMode] = useState<"text" | "json">("text");

  const modeTabs = [
    { value: "text" as const, label: t(M.modeText) },
    { value: "json" as const, label: t(M.modeJson) },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <GitCompare className="h-5 w-5 shrink-0 text-primary" aria-hidden />
        <Tabs items={modeTabs} value={mode} onChange={setMode} />
      </div>
      {/* Both sections stay mounted so inputs survive tab switches. */}
      <div className={mode === "text" ? undefined : "hidden"}>
        <TextDiffSection />
      </div>
      <div className={mode === "json" ? undefined : "hidden"}>
        <JsonDiffSection />
      </div>
    </div>
  );
}
