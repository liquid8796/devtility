"use client";

import { ArrowLeftRight, Check, Copy } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { CopyButton } from "@/components/ui/copy-button";
import { Field, Select, TextArea } from "@/components/ui/field";
import { Tabs } from "@/components/ui/tabs";
import type { Localized } from "@/lib/i18n";
import { useI18n } from "@/lib/i18n/use-lang";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Messages
// ---------------------------------------------------------------------------

const M = {
  copy: { vi: "Sao chép", en: "Copy" },
  copied: { vi: "Đã chép", en: "Copied" },
  encodeTab: { vi: "Mã hóa", en: "Encode" },
  decodeTab: { vi: "Giải mã", en: "Decode" },
  input: { vi: "Đầu vào", en: "Input" },
  output: { vi: "Kết quả", en: "Output" },
  chars: { vi: "ký tự", en: "chars" },
  bytes: { vi: "byte (UTF-8)", en: "bytes (UTF-8)" },
  swap: { vi: "Đảo chiều (dùng kết quả làm đầu vào)", en: "Swap direction (use output as input)" },

  b64Title: { vi: "Base64", en: "Base64" },
  b64Subtitle: {
    vi: "Mã hóa / giải mã Base64 chuẩn UTF-8, hỗ trợ biến thể URL-safe",
    en: "UTF-8-correct Base64 encode / decode with a URL-safe variant",
  },
  b64Standard: { vi: "Chuẩn", en: "Standard" },
  b64UrlSafe: { vi: "URL-safe", en: "URL-safe" },
  b64InputPlaceholderEncode: { vi: "Nhập văn bản cần mã hóa…", en: "Enter text to encode…" },
  b64InputPlaceholderDecode: { vi: "Dán chuỗi Base64 cần giải mã…", en: "Paste a Base64 string to decode…" },
  b64Invalid: {
    vi: "Chuỗi Base64 không hợp lệ — kiểm tra ký tự lạ hoặc phần đệm (=).",
    en: "Invalid Base64 string — check for stray characters or padding (=).",
  },
  b64BinaryNote: {
    vi: "Dữ liệu giải mã không phải văn bản UTF-8 hợp lệ — đang hiển thị byte thô (Latin-1).",
    en: "Decoded data is not valid UTF-8 — showing raw bytes as Latin-1.",
  },

  urlTitle: { vi: "URL encode/decode", en: "URL encode/decode" },
  urlSubtitle: {
    vi: "Mã hóa phần trăm (%) cho giá trị tham số hoặc toàn bộ URL",
    en: "Percent-encoding for parameter values or a whole URL",
  },
  urlModeComponent: { vi: "URIComponent (giá trị)", en: "URIComponent (value)" },
  urlModeFull: { vi: "URI (toàn URL)", en: "URI (full URL)" },
  urlMode: { vi: "Chế độ", en: "Mode" },
  urlInputPlaceholderEncode: { vi: "Nhập văn bản hoặc URL…", en: "Enter text or a URL…" },
  urlInputPlaceholderDecode: { vi: "Dán chuỗi đã mã hóa %…", en: "Paste a percent-encoded string…" },
  urlMalformed: {
    vi: "Chuỗi không hợp lệ — dãy thoát % bị sai định dạng (ví dụ %E0%A mất ký tự).",
    en: "Malformed input — a % escape sequence is incomplete (e.g. %E0%A).",
  },

  qsTitle: { vi: "Query string parser", en: "Query string parser" },
  qsSubtitle: {
    vi: "Dán URL đầy đủ hoặc chuỗi query để tách từng cặp key=value",
    en: "Paste a full URL or a raw query string to break out each key=value pair",
  },
  qsPlaceholder: {
    vi: "https://example.com/search?q=xin%20chào&tag=a&tag=b",
    en: "https://example.com/search?q=hello%20world&tag=a&tag=b",
  },
  qsHint: {
    vi: "Dán URL đầy đủ (phần trước dấu ? sẽ tự bị tách) hoặc chuỗi query thô như a=1&b=2.",
    en: "Paste a full URL (everything up to ? is stripped automatically) or a raw query like a=1&b=2.",
  },
  qsNoPairs: {
    vi: "Không tìm thấy cặp key=value nào trong chuỗi đã dán.",
    en: "No key=value pairs found in the pasted text.",
  },
  qsPairs: { vi: "cặp", en: "pairs" },
  qsCopyJson: { vi: "Copy JSON", en: "Copy JSON" },
  qsBaseUrl: { vi: "URL gốc:", en: "Base URL:" },
  qsKey: { vi: "Key", en: "Key" },
  qsValue: { vi: "Giá trị (đã giải mã)", en: "Decoded value" },
  qsEmptyValue: { vi: "(trống)", en: "(empty)" },
  qsCopyValue: { vi: "Sao chép giá trị", en: "Copy value" },
} satisfies Record<string, Localized>;

// ---------------------------------------------------------------------------
// Base64 helpers (UTF-8 correct, chunk-safe)
// ---------------------------------------------------------------------------

const CHUNK = 0x8000;

/** Uint8Array → binary string without blowing the argument limit. */
function bytesToBinary(bytes: Uint8Array): string {
  let out = "";
  for (let i = 0; i < bytes.length; i += CHUNK) {
    out += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return out;
}

function encodeBase64(text: string, urlSafe: boolean): string {
  const b64 = btoa(bytesToBinary(new TextEncoder().encode(text)));
  return urlSafe ? b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "") : b64;
}

type B64Outcome =
  | { ok: true; value: string; byteLength: number; binaryNote: boolean }
  | { ok: false; error: Localized };

function decodeBase64(input: string, urlSafe: boolean): B64Outcome {
  let s = input.replace(/\s+/g, "");
  if (urlSafe) s = s.replace(/-/g, "+").replace(/_/g, "/");
  if (s.length % 4 === 1) return { ok: false, error: M.b64Invalid };
  s += "=".repeat((4 - (s.length % 4)) % 4);
  let binary: string;
  try {
    binary = atob(s);
  } catch {
    return { ok: false, error: M.b64Invalid };
  }
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  try {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    return { ok: true, value: text, byteLength: bytes.length, binaryNote: false };
  } catch {
    // Not UTF-8 — fall back to a Latin-1 view of the raw bytes.
    return { ok: true, value: binary, byteLength: bytes.length, binaryNote: true };
  }
}

// ---------------------------------------------------------------------------
// Small shared pieces
// ---------------------------------------------------------------------------

/** Outline copy button with a visible custom label (e.g. "Copy JSON"). */
function LabeledCopyButton({ text, label }: { text: string; label: string }) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard unavailable (insecure context) — ignore.
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={copy}
      className={cn(copied && "border-success/60 text-success")}
    >
      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      {copied ? t(M.copied) : label}
    </Button>
  );
}

function CountsLine({ chars, bytes }: { chars: number; bytes?: number }) {
  const { t, locale } = useI18n();
  const nf = new Intl.NumberFormat(locale);
  return (
    <p className="text-xs text-muted-foreground">
      {nf.format(chars)} {t(M.chars)}
      {bytes !== undefined ? ` · ${nf.format(bytes)} ${t(M.bytes)}` : null}
    </p>
  );
}

type Direction = "encode" | "decode";

// ---------------------------------------------------------------------------
// Card 1 — Base64
// ---------------------------------------------------------------------------

type B64Variant = "standard" | "urlsafe";

function Base64Card() {
  const { t } = useI18n();
  const [direction, setDirection] = useState<Direction>("encode");
  const [variant, setVariant] = useState<B64Variant>("standard");
  const [input, setInput] = useState("");

  const result = useMemo<B64Outcome | null>(() => {
    if (!input) return null;
    if (direction === "encode") {
      const value = encodeBase64(input, variant === "urlsafe");
      return { ok: true, value, byteLength: new TextEncoder().encode(input).length, binaryNote: false };
    }
    return decodeBase64(input, variant === "urlsafe");
  }, [input, direction, variant]);

  const inputStats = useMemo(
    () => ({ chars: [...input].length, bytes: new TextEncoder().encode(input).length }),
    [input],
  );

  const output = result && result.ok ? result.value : "";

  const handleSwap = () => {
    setDirection(direction === "encode" ? "decode" : "encode");
    if (result && result.ok && !result.binaryNote) setInput(result.value);
  };

  return (
    <Card>
      <CardHeader
        title={t(M.b64Title)}
        subtitle={t(M.b64Subtitle)}
        actions={
          <Button variant="ghost" size="icon" onClick={handleSwap} aria-label={t(M.swap)} title={t(M.swap)}>
            <ArrowLeftRight className="h-4 w-4" />
          </Button>
        }
      />
      <CardBody className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Tabs
            items={[
              { value: "encode", label: t(M.encodeTab) },
              { value: "decode", label: t(M.decodeTab) },
            ]}
            value={direction}
            onChange={setDirection}
            size="sm"
          />
          <Tabs
            items={[
              { value: "standard", label: t(M.b64Standard) },
              { value: "urlsafe", label: t(M.b64UrlSafe) },
            ]}
            value={variant}
            onChange={setVariant}
            size="sm"
          />
        </div>

        <Field label={t(M.input)} htmlFor="b64-input">
          <TextArea
            id="b64-input"
            rows={4}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={t(direction === "encode" ? M.b64InputPlaceholderEncode : M.b64InputPlaceholderDecode)}
            spellCheck={false}
          />
        </Field>
        {input ? <CountsLine chars={inputStats.chars} bytes={inputStats.bytes} /> : null}

        {result && !result.ok ? (
          <p className="text-sm text-danger">{t(result.error)}</p>
        ) : (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {t(M.output)}
              </span>
              {output ? <CopyButton text={output} label={t(M.copy)} /> : null}
            </div>
            <TextArea rows={4} value={output} readOnly aria-label={t(M.output)} spellCheck={false} />
            {result && result.ok ? (
              <CountsLine
                chars={[...output].length}
                bytes={direction === "decode" ? result.byteLength : undefined}
              />
            ) : null}
            {result && result.ok && result.binaryNote ? (
              <p className="text-xs text-warning">{t(M.b64BinaryNote)}</p>
            ) : null}
          </div>
        )}
      </CardBody>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Card 2 — URL encode/decode
// ---------------------------------------------------------------------------

type UrlMode = "component" | "uri";

function UrlEncodeCard() {
  const { t } = useI18n();
  const [direction, setDirection] = useState<Direction>("encode");
  const [mode, setMode] = useState<UrlMode>("component");
  const [input, setInput] = useState("");

  const result = useMemo<{ ok: true; value: string } | { ok: false; error: Localized } | null>(() => {
    if (!input) return null;
    try {
      if (direction === "encode") {
        return { ok: true, value: mode === "component" ? encodeURIComponent(input) : encodeURI(input) };
      }
      return { ok: true, value: mode === "component" ? decodeURIComponent(input) : decodeURI(input) };
    } catch {
      return { ok: false, error: M.urlMalformed };
    }
  }, [input, direction, mode]);

  const fnPrefix = direction === "encode" ? "encode" : "decode";

  return (
    <Card>
      <CardHeader title={t(M.urlTitle)} subtitle={t(M.urlSubtitle)} />
      <CardBody className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <Tabs
            items={[
              { value: "encode", label: t(M.encodeTab) },
              { value: "decode", label: t(M.decodeTab) },
            ]}
            value={direction}
            onChange={setDirection}
            size="sm"
          />
          <Select
            aria-label={t(M.urlMode)}
            value={mode}
            onChange={(e) => setMode(e.target.value as UrlMode)}
            className="h-9 w-auto min-w-56 text-xs"
          >
            <option value="component">{`${fnPrefix}URIComponent — ${t(M.urlModeComponent)}`}</option>
            <option value="uri">{`${fnPrefix}URI — ${t(M.urlModeFull)}`}</option>
          </Select>
        </div>

        <Field label={t(M.input)} htmlFor="url-input">
          <TextArea
            id="url-input"
            rows={3}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={t(direction === "encode" ? M.urlInputPlaceholderEncode : M.urlInputPlaceholderDecode)}
            spellCheck={false}
          />
        </Field>

        {result && !result.ok ? (
          <p className="text-sm text-danger">{t(result.error)}</p>
        ) : (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {t(M.output)}
              </span>
              {result && result.ok && result.value ? <CopyButton text={result.value} label={t(M.copy)} /> : null}
            </div>
            <TextArea
              rows={3}
              value={result && result.ok ? result.value : ""}
              readOnly
              aria-label={t(M.output)}
              spellCheck={false}
            />
          </div>
        )}
      </CardBody>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Card 3 — Query string parser
// ---------------------------------------------------------------------------

interface QueryRow {
  n: number;
  key: string;
  value: string;
  /** First row of its key group renders the key cell (with rowSpan). */
  first: boolean;
  groupSize: number;
}

interface ParsedQuery {
  baseUrl: string | null;
  rows: QueryRow[];
  count: number;
  json: string;
}

function parseQuery(raw: string): ParsedQuery {
  let baseUrl: string | null = null;
  let query = raw;

  try {
    const url = new URL(raw);
    baseUrl = url.origin + url.pathname;
    query = url.search;
  } catch {
    // Not an absolute URL — strip everything up to the first "?" manually.
    const qIdx = raw.indexOf("?");
    if (qIdx !== -1) {
      baseUrl = raw.slice(0, qIdx) || null;
      query = raw.slice(qIdx + 1);
    }
    const hIdx = query.indexOf("#");
    if (hIdx !== -1) query = query.slice(0, hIdx);
  }
  query = query.replace(/^\?/, "");

  const params = new URLSearchParams(query);
  const keys: string[] = [];
  for (const key of params.keys()) {
    if (!keys.includes(key)) keys.push(key);
  }

  const rows: QueryRow[] = [];
  let n = 0;
  const jsonObj: Record<string, string | string[]> = {};
  for (const key of keys) {
    const values = params.getAll(key);
    jsonObj[key] = values.length === 1 ? values[0] : values;
    values.forEach((value, i) => {
      n += 1;
      rows.push({ n, key, value, first: i === 0, groupSize: values.length });
    });
  }

  return { baseUrl, rows, count: n, json: n > 0 ? JSON.stringify(jsonObj, null, 2) : "" };
}

function QueryStringCard() {
  const { t, locale } = useI18n();
  const [input, setInput] = useState("");

  const parsed = useMemo(() => {
    const raw = input.trim();
    return raw ? parseQuery(raw) : null;
  }, [input]);

  const nf = new Intl.NumberFormat(locale);

  return (
    <Card>
      <CardHeader
        title={t(M.qsTitle)}
        subtitle={
          parsed?.baseUrl ? (
            <span className="break-all font-mono">
              {t(M.qsBaseUrl)} {parsed.baseUrl}
            </span>
          ) : (
            t(M.qsSubtitle)
          )
        }
        actions={
          parsed && parsed.count > 0 ? (
            <>
              <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                {nf.format(parsed.count)} {t(M.qsPairs)}
              </span>
              <LabeledCopyButton text={parsed.json} label={t(M.qsCopyJson)} />
            </>
          ) : undefined
        }
      />
      <CardBody className="space-y-4">
        <Field label={t(M.input)} htmlFor="qs-input" hint={!input ? t(M.qsHint) : undefined}>
          <TextArea
            id="qs-input"
            rows={3}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={t(M.qsPlaceholder)}
            spellCheck={false}
          />
        </Field>

        {parsed && parsed.count === 0 ? (
          <p className="text-sm text-muted-foreground">{t(M.qsNoPairs)}</p>
        ) : null}

        {parsed && parsed.count > 0 ? (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full min-w-[28rem] text-sm">
              <thead>
                <tr className="bg-muted text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  <th className="w-10 px-3 py-2">#</th>
                  <th className="px-3 py-2">{t(M.qsKey)}</th>
                  <th className="px-3 py-2">{t(M.qsValue)}</th>
                  <th className="w-20 px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {parsed.rows.map((row) => (
                  <tr key={row.n} className="border-t border-border align-top">
                    <td className="px-3 py-2 font-mono text-xs text-muted-foreground">{row.n}</td>
                    {row.first ? (
                      <td rowSpan={row.groupSize} className="px-3 py-2 font-mono text-primary">
                        <span className="break-all">{row.key}</span>
                        {row.groupSize > 1 ? (
                          <span className="ml-1.5 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium">
                            ×{row.groupSize}
                          </span>
                        ) : null}
                      </td>
                    ) : null}
                    <td className="px-3 py-2 font-mono break-all">
                      {row.value !== "" ? (
                        row.value
                      ) : (
                        <span className="text-muted-foreground">{t(M.qsEmptyValue)}</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <CopyButton text={row.value} label={t(M.qsCopyValue)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </CardBody>
    </Card>
  );
}

// ---------------------------------------------------------------------------

export default function Base64UrlTool() {
  return (
    <div className="space-y-6">
      <Base64Card />
      <UrlEncodeCard />
      <QueryStringCard />
    </div>
  );
}
