"use client";

import { format, type FormatOptionsWithLanguage } from "sql-formatter";
import { Braces, Eraser, FileCode2, Wand2 } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { CopyButton } from "@/components/ui/copy-button";
import { Field, Select, TextArea } from "@/components/ui/field";
import type { Localized } from "@/lib/i18n";
import { useI18n } from "@/lib/i18n/use-lang";
import { cn } from "@/lib/utils";

import { minifySql, tokenizeSql, type Token } from "./highlight";

const M = {
  title: { vi: "Trình định dạng SQL", en: "SQL formatter" },
  subtitle: {
    vi: "Định dạng, rút gọn và tô sáng cú pháp SQL — chạy hoàn toàn trên trình duyệt",
    en: "Format, minify and highlight SQL — runs entirely in your browser",
  },
  dialect: { vi: "Phương ngữ", en: "Dialect" },
  standard: { vi: "Chuẩn", en: "Standard" },
  keywordCase: { vi: "Chữ khóa", en: "Keyword case" },
  preserve: { vi: "Giữ nguyên", en: "Preserve" },
  indent: { vi: "Thụt lề", en: "Indent" },
  spaces: { vi: "dấu cách", en: "spaces" },
  formatBtn: { vi: "Định dạng", en: "Format" },
  minifyBtn: { vi: "Rút gọn", en: "Minify" },
  sampleBtn: { vi: "SQL mẫu", en: "Sample" },
  clearBtn: { vi: "Xóa", en: "Clear" },
  inputLabel: { vi: "SQL đầu vào", en: "Input SQL" },
  outputLabel: { vi: "Kết quả", en: "Output" },
  inputPlaceholder: {
    vi: "Dán câu SQL vào đây…",
    en: "Paste your SQL here…",
  },
  outputEmpty: {
    vi: "Nhấn “Định dạng” hoặc “Rút gọn” để xem kết quả.",
    en: "Press “Format” or “Minify” to see the result.",
  },
  formatError: {
    vi: "Không định dạng được SQL — vui lòng kiểm tra cú pháp. Đầu vào được giữ nguyên.",
    en: "Could not format the SQL — please check the syntax. Your input is untouched.",
  },
  minifyNote: {
    vi: "Ghi chú: rút gọn sẽ loại bỏ toàn bộ chú thích (comment).",
    en: "Note: minify drops all comments.",
  },
  copyOutput: { vi: "Sao chép kết quả", en: "Copy output" },
  lines: { vi: "dòng", en: "lines" },
  chars: { vi: "ký tự", en: "chars" },
  statsIn: { vi: "Vào", en: "In" },
  statsOut: { vi: "Ra", en: "Out" },
} satisfies Record<string, Localized>;

const STORAGE_KEY = "devtility.sql";

const SAMPLE_SQL = `-- Doanh thu theo khách hàng / revenue per customer
select c.id, c.name, count(o.id) as total_orders,
  sum(o.amount) as revenue,
  case when sum(o.amount) > 1000 then 'vip' else 'regular' end as tier
from customers c
left join orders o on o.customer_id = c.id and o.status = 'paid'
where c.created_at >= '2024-01-01' /* chỉ khách mới */
group by c.id, c.name
having count(o.id) > 0
order by revenue desc
limit 20;`;

type Dialect = "mysql" | "postgresql" | "plsql" | "sql";
type KeywordCase = "upper" | "lower" | "preserve";

const TOKEN_CLASS: Record<Token["type"], string | null> = {
  keyword: "text-primary font-semibold",
  string: "text-success",
  number: "text-accent",
  comment: "text-muted-foreground italic",
  function: "text-warning",
  punctuation: null,
  identifier: null,
  whitespace: null,
};

function HighlightedSql({ sql }: { sql: string }) {
  const nodes = useMemo<ReactNode[]>(
    () =>
      tokenizeSql(sql).map((token, index) => {
        const className = TOKEN_CLASS[token.type];
        return className ? (
          <span key={index} className={className}>
            {token.text}
          </span>
        ) : (
          token.text
        );
      }),
    [sql],
  );
  return (
    <pre className="min-h-full whitespace-pre px-4 py-3 font-mono text-sm leading-relaxed">
      <code>{nodes}</code>
    </pre>
  );
}

function readStoredSql(): string {
  try {
    return window.localStorage.getItem(STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

export default function SqlFormatterTool() {
  const { t, locale } = useI18n();

  // Tools mount with ssr:false, so lazy-reading localStorage here is safe.
  const [input, setInput] = useState(readStoredSql);
  const [output, setOutput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [minified, setMinified] = useState(false);

  const [dialect, setDialect] = useState<Dialect>("mysql");
  const [keywordCase, setKeywordCase] = useState<KeywordCase>("upper");
  const [indent, setIndent] = useState<2 | 4>(2);

  // Persist input (debounced ~300ms) so the SQL survives reloads.
  useEffect(() => {
    const id = setTimeout(() => {
      try {
        window.localStorage.setItem(STORAGE_KEY, input);
      } catch {
        // storage unavailable (private mode / quota) — non-fatal
      }
    }, 300);
    return () => clearTimeout(id);
  }, [input]);

  const runFormat = () => {
    setMinified(false);
    try {
      const options: FormatOptionsWithLanguage = {
        language: dialect,
        keywordCase,
        tabWidth: indent,
      };
      setOutput(format(input, options));
      setError(null);
    } catch (e) {
      // Keep the input and the previous output untouched; just surface the error.
      setError(e instanceof Error ? e.message.split("\n")[0] : String(e));
    }
  };

  const runMinify = () => {
    setOutput(minifySql(input));
    setError(null);
    setMinified(true);
  };

  const loadSample = () => {
    setInput(SAMPLE_SQL);
    setOutput("");
    setError(null);
    setMinified(false);
  };

  const clearAll = () => {
    setInput("");
    setOutput("");
    setError(null);
    setMinified(false);
  };

  const nf = useMemo(() => new Intl.NumberFormat(locale), [locale]);
  const countLines = (text: string) => (text === "" ? 0 : text.split("\n").length);

  return (
    <Card className="animate-fade-up">
      <CardHeader
        title={
          <span className="inline-flex items-center gap-2">
            <FileCode2 className="h-4 w-4 text-primary" aria-hidden />
            {t(M.title)}
          </span>
        }
        subtitle={t(M.subtitle)}
        actions={<CopyButton text={output} label={t(M.copyOutput)} />}
      />
      <CardBody className="space-y-4">
        <div className="flex flex-wrap items-end gap-3">
          <Field label={t(M.dialect)} htmlFor="sql-dialect" className="w-full min-w-36 sm:w-auto">
            <Select
              id="sql-dialect"
              value={dialect}
              onChange={(e) => setDialect(e.target.value as Dialect)}
            >
              <option value="mysql">MySQL</option>
              <option value="postgresql">PostgreSQL</option>
              <option value="plsql">Oracle (PL/SQL)</option>
              <option value="sql">{t(M.standard)}</option>
            </Select>
          </Field>
          <Field label={t(M.keywordCase)} htmlFor="sql-case" className="w-full min-w-36 sm:w-auto">
            <Select
              id="sql-case"
              value={keywordCase}
              onChange={(e) => setKeywordCase(e.target.value as KeywordCase)}
            >
              <option value="upper">UPPERCASE</option>
              <option value="lower">lowercase</option>
              <option value="preserve">{t(M.preserve)}</option>
            </Select>
          </Field>
          <Field label={t(M.indent)} htmlFor="sql-indent" className="w-full min-w-28 sm:w-auto">
            <Select
              id="sql-indent"
              value={String(indent)}
              onChange={(e) => setIndent(e.target.value === "4" ? 4 : 2)}
            >
              <option value="2">2 {t(M.spaces)}</option>
              <option value="4">4 {t(M.spaces)}</option>
            </Select>
          </Field>

          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={runFormat} disabled={input.trim() === ""}>
              <Wand2 className="h-4 w-4" />
              {t(M.formatBtn)}
            </Button>
            <Button variant="outline" onClick={runMinify} disabled={input.trim() === ""}>
              <Braces className="h-4 w-4" />
              {t(M.minifyBtn)}
            </Button>
            <Button variant="ghost" onClick={loadSample}>
              {t(M.sampleBtn)}
            </Button>
            <Button
              variant="ghost"
              onClick={clearAll}
              disabled={input === "" && output === ""}
              aria-label={t(M.clearBtn)}
            >
              <Eraser className="h-4 w-4" />
              {t(M.clearBtn)}
            </Button>
          </div>
        </div>

        {error ? (
          <div className="rounded-lg bg-danger/10 px-4 py-3 text-sm text-danger">
            <p className="font-medium">{t(M.formatError)}</p>
            <p className="mt-0.5 font-mono text-xs opacity-80">{error}</p>
          </div>
        ) : null}

        {minified && output !== "" ? (
          <p className="rounded-lg bg-warning/10 px-4 py-2 text-xs text-warning">
            {t(M.minifyNote)}
          </p>
        ) : null}

        <div className="grid gap-4 lg:grid-cols-2">
          <div>
            <Field label={t(M.inputLabel)} htmlFor="sql-input">
              <TextArea
                id="sql-input"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={t(M.inputPlaceholder)}
                spellCheck={false}
                rows={14}
                className="min-h-72 resize-y"
              />
            </Field>
          </div>
          <div>
            <p className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {t(M.outputLabel)}
            </p>
            <div
              className={cn(
                "min-h-72 overflow-auto rounded-lg border border-border bg-muted/40",
                output === "" && "flex items-center justify-center",
              )}
            >
              {output === "" ? (
                <p className="px-6 text-center text-sm text-muted-foreground">
                  {t(M.outputEmpty)}
                </p>
              ) : (
                <HighlightedSql sql={output} />
              )}
            </div>
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          {t(M.statsIn)}: {nf.format(countLines(input))} {t(M.lines)} ·{" "}
          {nf.format(input.length)} {t(M.chars)}
          <span className="mx-2 text-border">|</span>
          {t(M.statsOut)}: {nf.format(countLines(output))} {t(M.lines)} ·{" "}
          {nf.format(output.length)} {t(M.chars)}
        </p>
      </CardBody>
    </Card>
  );
}
