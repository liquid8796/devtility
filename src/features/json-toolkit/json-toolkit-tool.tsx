"use client";

import {
  AlertTriangle,
  ArrowDownAZ,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  FileJson,
  Minimize2,
  Trash2,
  Wand2,
} from "lucide-react";
import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { CopyButton } from "@/components/ui/copy-button";
import { Select, TextArea } from "@/components/ui/field";
import { Tabs } from "@/components/ui/tabs";
import type { Localized } from "@/lib/i18n";
import { useI18n } from "@/lib/i18n/use-lang";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Messages
// ---------------------------------------------------------------------------

const M = {
  inputTitle: { vi: "Đầu vào", en: "Input" },
  inputSubtitle: { vi: "Dán hoặc nhập JSON của bạn", en: "Paste or type your JSON" },
  outputTitle: { vi: "Kết quả", en: "Output" },
  outputSubtitle: { vi: "Chọn một thao tác ở cột bên trái", en: "Pick an action in the left column" },
  format: { vi: "Định dạng", en: "Format" },
  minify: { vi: "Nén gọn", en: "Minify" },
  sortKeys: { vi: "Sắp xếp khóa", en: "Sort keys" },
  escape: { vi: "Escape", en: "Escape" },
  unescape: { vi: "Unescape", en: "Unescape" },
  clear: { vi: "Xóa", en: "Clear" },
  sample: { vi: "Dữ liệu mẫu", en: "Sample" },
  indentLabel: { vi: "Thụt lề", en: "Indentation" },
  indent2: { vi: "2 dấu cách", en: "2 spaces" },
  indent4: { vi: "4 dấu cách", en: "4 spaces" },
  indentTab: { vi: "Tab", en: "Tab" },
  inputPlaceholder: { vi: 'Ví dụ: { "name": "DevTility" }', en: 'e.g. { "name": "DevTility" }' },
  outputPlaceholder: { vi: "Kết quả sẽ hiển thị ở đây…", en: "The result will appear here…" },
  valid: { vi: "JSON hợp lệ", en: "Valid JSON" },
  invalid: { vi: "JSON không hợp lệ", en: "Invalid JSON" },
  emptyHint: {
    vi: "Dán JSON vào ô trên để kiểm tra và định dạng.",
    en: "Paste JSON above to validate and format it.",
  },
  bytesUnit: { vi: "byte", en: "bytes" },
  keysUnit: { vi: "khóa", en: "keys" },
  depthUnit: { vi: "độ sâu", en: "depth" },
  textTab: { vi: "Văn bản", en: "Text" },
  treeTab: { vi: "Dạng cây", en: "Tree view" },
  expandAll: { vi: "Mở tất cả", en: "Expand all" },
  collapseAll: { vi: "Đóng tất cả", en: "Collapse all" },
  treeEmpty: { vi: "Chưa có kết quả để hiển thị.", en: "No output to display yet." },
  treeUnavailable: {
    vi: "Kết quả hiện tại không phải JSON nên không thể hiển thị dạng cây.",
    en: "The current output is not JSON, so the tree view is unavailable.",
  },
  capNotice: {
    vi: "Tài liệu lớn: chỉ hiển thị 2.000 nút đầu tiên trong dạng cây.",
    en: "Large document: only the first 2,000 nodes are shown in the tree.",
  },
  cannotProcess: {
    vi: "Không thể xử lý: đầu vào không phải JSON hợp lệ.",
    en: "Cannot process: the input is not valid JSON.",
  },
  notStringLiteral: {
    vi: "Không thể unescape: đầu vào không phải một chuỗi JSON (string literal).",
    en: "Cannot unescape: the input is not a JSON string literal.",
  },
  copy: { vi: "Sao chép kết quả", en: "Copy output" },
} satisfies Record<string, Localized>;

// ---------------------------------------------------------------------------
// JSON helpers
// ---------------------------------------------------------------------------

type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

const STORAGE_KEY = "devtility.json-toolkit";
const NODE_CAP = 2000;
const AUTO_EXPAND_DEPTH = 2;

const SAMPLE = `{
  "app": "DevTility",
  "version": 1.2,
  "tác_giả": {
    "tên": "Nam Trần",
    "thành_phố": "Hà Nội"
  },
  "tags": ["json", "công cụ", "ツール", "développeur"],
  "stats": {
    "downloads": 152304,
    "rating": 4.8,
    "active": true,
    "deprecated": null
  },
  "history": [
    { "year": 2024, "users": 1200 },
    { "year": 2025, "users": 86500 }
  ],
  "unicode": "Xin chào 👋 — Tiếng Việt ✓"
}`;

function isContainer(v: JsonValue): v is JsonValue[] | { [key: string]: JsonValue } {
  return v !== null && typeof v === "object";
}

/** Recursively count every object key (arrays contribute their items' keys). */
function countKeys(v: JsonValue): number {
  if (Array.isArray(v)) return v.reduce<number>((sum, item) => sum + countKeys(item), 0);
  if (isContainer(v)) {
    const values = Object.values(v);
    return values.length + values.reduce<number>((sum, item) => sum + countKeys(item), 0);
  }
  return 0;
}

/** Nesting depth: primitives are 0, {} / [] are 1, { a: {} } is 2… */
function maxDepth(v: JsonValue): number {
  if (Array.isArray(v)) return 1 + v.reduce<number>((max, item) => Math.max(max, maxDepth(item)), 0);
  if (isContainer(v)) {
    return 1 + Object.values(v).reduce<number>((max, item) => Math.max(max, maxDepth(item)), 0);
  }
  return 0;
}

/** Total node count (each value, container or leaf, counts as one node). */
function countNodes(v: JsonValue): number {
  if (Array.isArray(v)) return 1 + v.reduce<number>((sum, item) => sum + countNodes(item), 0);
  if (isContainer(v)) {
    return 1 + Object.values(v).reduce<number>((sum, item) => sum + countNodes(item), 0);
  }
  return 1;
}

/** Recursively sort object keys A→Z; arrays keep their order. */
function sortKeysDeep(v: JsonValue): JsonValue {
  if (Array.isArray(v)) return v.map(sortKeysDeep);
  if (isContainer(v)) {
    const out: { [key: string]: JsonValue } = {};
    for (const key of Object.keys(v).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))) {
      out[key] = sortKeysDeep(v[key]);
    }
    return out;
  }
  return v;
}

function lineColAt(text: string, pos: number): { line: number; col: number } {
  const clamped = Math.min(Math.max(pos, 0), text.length);
  const before = text.slice(0, clamped);
  const lastBreak = before.lastIndexOf("\n");
  const line = (before.match(/\n/g)?.length ?? 0) + 1;
  return { line, col: clamped - lastBreak };
}

/** Extract line/column from a V8 JSON.parse error message. */
function locateJsonError(message: string, text: string): { line: number; col: number } | null {
  // Newest V8: "… in JSON at position N (line L column C)".
  const lineCol = message.match(/line (\d+) column (\d+)/i);
  if (lineCol) return { line: Number(lineCol[1]), col: Number(lineCol[2]) };
  // Older V8: "… in JSON at position N".
  const position = message.match(/position (\d+)/i);
  if (position) return lineColAt(text, Number(position[1]));
  // V8 "Unexpected token 'x', …\"<tail>\" is not valid JSON": the quoted tail runs
  // to the end of the input and starts 10 characters before the offending token.
  const tail = message.match(/\.\.\."([\s\S]*)" is not valid JSON$/);
  if (tail && text.endsWith(tail[1])) return lineColAt(text, text.length - tail[1].length + 10);
  return null;
}

type Validation =
  | { state: "empty" }
  | { state: "valid"; bytes: number; keys: number; depth: number }
  | { state: "invalid"; message: string; line: number | null; col: number | null };

function validate(text: string): Validation {
  if (text.trim() === "") return { state: "empty" };
  try {
    const value = JSON.parse(text) as JsonValue;
    return {
      state: "valid",
      bytes: new TextEncoder().encode(text).length,
      keys: countKeys(value),
      depth: maxDepth(value),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const location = locateJsonError(message, text);
    return {
      state: "invalid",
      message,
      line: location?.line ?? null,
      col: location?.col ?? null,
    };
  }
}

// ---------------------------------------------------------------------------
// Tree view
// ---------------------------------------------------------------------------

function leafClass(v: null | boolean | number | string): string {
  if (v === null) return "text-muted-foreground italic";
  if (typeof v === "string") return "text-success";
  if (typeof v === "number") return "text-accent";
  return "text-warning";
}

function leafText(v: null | boolean | number | string): string {
  if (v === null) return "null";
  if (typeof v === "string") return JSON.stringify(v);
  return String(v);
}

/** Container paths auto-expanded on first render (root + one level below). */
function collectDefaultExpanded(v: JsonValue, out: Set<string>, path: string, depth: number): void {
  if (!isContainer(v) || depth >= AUTO_EXPAND_DEPTH) return;
  out.add(path);
  const children = Array.isArray(v) ? v : Object.values(v);
  children.forEach((child, index) => {
    collectDefaultExpanded(child, out, `${path}.${index}`, depth + 1);
  });
}

type ExpandBase = "default" | "all" | "none";

function TreeView({ value }: { value: JsonValue }) {
  const { t } = useI18n();
  const [base, setBase] = useState<ExpandBase>("default");
  const [toggled, setToggled] = useState<ReadonlySet<string>>(() => new Set());

  const defaultExpanded = useMemo(() => {
    const set = new Set<string>();
    collectDefaultExpanded(value, set, "$", 0);
    return set;
  }, [value]);

  const totalNodes = useMemo(() => countNodes(value), [value]);

  const isExpanded = (path: string): boolean => {
    const baseOn = base === "all" ? true : base === "none" ? false : defaultExpanded.has(path);
    return toggled.has(path) ? !baseOn : baseOn;
  };

  const toggle = (path: string) => {
    setToggled((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  const rows: ReactNode[] = [];
  const counter = { n: 0 };

  const emit = (label: ReactNode, node: JsonValue, path: string, depth: number): void => {
    if (counter.n >= NODE_CAP) return;
    counter.n += 1;
    const pad: CSSProperties = { paddingLeft: `${depth * 1.1 + 0.25}rem` };

    if (isContainer(node)) {
      const entries: ReadonlyArray<readonly [string | number, JsonValue]> = Array.isArray(node)
        ? node.map((item, i) => [i, item] as const)
        : Object.entries(node);
      const open = isExpanded(path);
      const summary = Array.isArray(node) ? `[${entries.length}]` : `{${entries.length}}`;
      rows.push(
        <button
          key={path}
          type="button"
          onClick={() => toggle(path)}
          style={pad}
          className="flex w-full items-center gap-1.5 rounded px-1 py-0.5 text-left font-mono text-xs transition-colors hover:bg-muted"
        >
          {open ? (
            <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          )}
          {label}
          <span className="text-muted-foreground">{summary}</span>
        </button>,
      );
      if (open) {
        entries.forEach(([key, child], index) => {
          if (counter.n >= NODE_CAP) return;
          const childLabel = Array.isArray(node) ? (
            <span className="shrink-0 text-muted-foreground">{key}:</span>
          ) : (
            <span className="shrink-0 text-foreground">{key}:</span>
          );
          emit(childLabel, child, `${path}.${index}`, depth + 1);
        });
      }
    } else {
      rows.push(
        <div key={path} style={pad} className="flex items-start gap-1.5 px-1 py-0.5 font-mono text-xs">
          <span className="w-3.5 shrink-0" aria-hidden />
          {label}
          <span className={cn("break-all", leafClass(node))}>{leafText(node)}</span>
        </div>,
      );
    }
  };

  emit(<span className="shrink-0 text-muted-foreground">$</span>, value, "$", 0);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            setBase("all");
            setToggled(new Set());
          }}
        >
          {t(M.expandAll)}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            setBase("none");
            setToggled(new Set());
          }}
        >
          {t(M.collapseAll)}
        </Button>
      </div>
      {totalNodes > NODE_CAP ? <p className="text-xs text-warning">{t(M.capNotice)}</p> : null}
      <div className="max-h-[28rem] overflow-auto rounded-lg border border-border bg-muted/30 p-2">
        {rows}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Status bar
// ---------------------------------------------------------------------------

function StatusBar({ validation }: { validation: Validation }) {
  const { lang, t, locale } = useI18n();

  if (validation.state === "empty") {
    return (
      <div className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
        {t(M.emptyHint)}
      </div>
    );
  }

  if (validation.state === "valid") {
    return (
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-lg border border-success/40 bg-success/10 px-3 py-2 text-xs">
        <span className="inline-flex items-center gap-1 font-medium text-success">
          <CheckCircle2 className="h-3.5 w-3.5" />
          {t(M.valid)}
        </span>
        <span className="text-muted-foreground">
          {validation.bytes.toLocaleString(locale)} {t(M.bytesUnit)} ·{" "}
          {validation.keys.toLocaleString(locale)} {t(M.keysUnit)} · {t(M.depthUnit)}{" "}
          {validation.depth.toLocaleString(locale)}
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-1 rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-xs">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="inline-flex items-center gap-1 font-medium text-danger">
          <AlertTriangle className="h-3.5 w-3.5" />
          {t(M.invalid)}
        </span>
        {validation.line !== null && validation.col !== null ? (
          <span className="font-medium text-danger">
            {lang === "vi"
              ? `Dòng ${validation.line}, cột ${validation.col}`
              : `Line ${validation.line}, column ${validation.col}`}
          </span>
        ) : null}
      </div>
      <p className="break-all font-mono text-muted-foreground">{validation.message}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

type IndentChoice = "2" | "4" | "tab";
type OutputTab = "text" | "tree";

export default function JsonToolkitTool() {
  const { t } = useI18n();
  const [input, setInput] = useState<string>(() => {
    try {
      return window.localStorage.getItem(STORAGE_KEY) ?? "";
    } catch {
      return "";
    }
  });
  const [debounced, setDebounced] = useState(input);
  const [indent, setIndent] = useState<IndentChoice>("2");
  const [output, setOutput] = useState("");
  const [outputVersion, setOutputVersion] = useState(0);
  const [outputTab, setOutputTab] = useState<OutputTab>("text");
  const [actionError, setActionError] = useState<Localized | null>(null);

  // Debounced validation + persistence (setState only inside the timeout callback).
  useEffect(() => {
    const id = setTimeout(() => {
      setDebounced(input);
      try {
        window.localStorage.setItem(STORAGE_KEY, input);
      } catch {
        // Private mode — persistence unavailable, ignore.
      }
    }, 300);
    return () => clearTimeout(id);
  }, [input]);

  const validation = useMemo(() => validate(debounced), [debounced]);

  const treeValue = useMemo<
    { state: "empty" } | { state: "ok"; value: JsonValue } | { state: "bad" }
  >(() => {
    if (output.trim() === "") return { state: "empty" };
    try {
      return { state: "ok", value: JSON.parse(output) as JsonValue };
    } catch {
      return { state: "bad" };
    }
  }, [output]);

  const indentValue: string | number = indent === "tab" ? "\t" : indent === "4" ? 4 : 2;

  const publish = (text: string) => {
    setOutput(text);
    setOutputVersion((v) => v + 1);
    setActionError(null);
  };

  const runWithParsed = (fn: (v: JsonValue) => string) => {
    try {
      publish(fn(JSON.parse(input) as JsonValue));
    } catch {
      setActionError(M.cannotProcess);
    }
  };

  const handleEscape = () => {
    if (input === "") return;
    publish(JSON.stringify(input));
  };

  const handleUnescape = () => {
    try {
      const parsed = JSON.parse(input) as unknown;
      if (typeof parsed !== "string") {
        setActionError(M.notStringLiteral);
        return;
      }
      publish(parsed);
    } catch {
      setActionError(M.notStringLiteral);
    }
  };

  const handleClear = () => {
    setInput("");
    setDebounced("");
    publish("");
  };

  const handleSample = () => {
    setInput(SAMPLE);
    setDebounced(SAMPLE);
    setActionError(null);
  };

  const tabItems = [
    { value: "text" as const, label: t(M.textTab) },
    { value: "tree" as const, label: t(M.treeTab) },
  ];

  return (
    <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader
          title={t(M.inputTitle)}
          subtitle={t(M.inputSubtitle)}
          actions={
            <>
              <Button size="sm" variant="outline" onClick={handleSample}>
                <FileJson className="h-3.5 w-3.5" />
                {t(M.sample)}
              </Button>
              <Button size="sm" variant="ghost" onClick={handleClear}>
                <Trash2 className="h-3.5 w-3.5" />
                {t(M.clear)}
              </Button>
            </>
          }
        />
        <CardBody className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" onClick={() => runWithParsed((v) => JSON.stringify(v, null, indentValue))}>
              <Wand2 className="h-3.5 w-3.5" />
              {t(M.format)}
            </Button>
            <Select
              aria-label={t(M.indentLabel)}
              value={indent}
              onChange={(e) => setIndent(e.target.value as IndentChoice)}
              className="h-8 w-32 pr-7 text-xs"
            >
              <option value="2">{t(M.indent2)}</option>
              <option value="4">{t(M.indent4)}</option>
              <option value="tab">{t(M.indentTab)}</option>
            </Select>
            <Button size="sm" variant="outline" onClick={() => runWithParsed((v) => JSON.stringify(v))}>
              <Minimize2 className="h-3.5 w-3.5" />
              {t(M.minify)}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => runWithParsed((v) => JSON.stringify(sortKeysDeep(v), null, indentValue))}
            >
              <ArrowDownAZ className="h-3.5 w-3.5" />
              {t(M.sortKeys)}
            </Button>
            <Button size="sm" variant="outline" onClick={handleEscape}>
              {t(M.escape)}
            </Button>
            <Button size="sm" variant="outline" onClick={handleUnescape}>
              {t(M.unescape)}
            </Button>
          </div>

          {actionError ? <p className="text-sm text-danger">{t(actionError)}</p> : null}

          <TextArea
            rows={16}
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              setActionError(null);
            }}
            placeholder={t(M.inputPlaceholder)}
            spellCheck={false}
            className="min-h-[20rem]"
          />

          <StatusBar validation={validation} />
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title={t(M.outputTitle)}
          subtitle={t(M.outputSubtitle)}
          actions={<CopyButton text={output} label={t(M.copy)} />}
        />
        <CardBody className="space-y-3">
          <Tabs items={tabItems} value={outputTab} onChange={setOutputTab} size="sm" />
          {outputTab === "text" ? (
            <TextArea
              readOnly
              rows={18}
              value={output}
              placeholder={t(M.outputPlaceholder)}
              spellCheck={false}
              className="min-h-[24rem] bg-muted/30"
            />
          ) : treeValue.state === "ok" ? (
            <TreeView key={outputVersion} value={treeValue.value} />
          ) : (
            <div className="rounded-lg border border-border bg-muted/30 p-6 text-center text-sm text-muted-foreground">
              {treeValue.state === "empty" ? t(M.treeEmpty) : t(M.treeUnavailable)}
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
