"use client";

import { BookOpen, ChevronDown, ChevronUp, Code2, Regex, Replace } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";

import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { CopyButton } from "@/components/ui/copy-button";
import { Field, TextArea, TextInput } from "@/components/ui/field";
import { Tabs } from "@/components/ui/tabs";
import type { Localized } from "@/lib/i18n";
import { useI18n } from "@/lib/i18n/use-lang";
import { cn } from "@/lib/utils";

import { buildSnippet, type SnippetLang } from "./codegen";

const MATCH_CAP = 1000;
const LIST_CAP = 200;

const M = {
  patternTitle: { vi: "Biểu thức chính quy", en: "Regular expression" },
  patternSubtitle: {
    vi: "Nhập pattern và bật/tắt cờ, kết quả cập nhật trực tiếp",
    en: "Type a pattern and toggle flags, results update live",
  },
  patternPlaceholder: { vi: "pattern…", en: "pattern…" },
  invalidPattern: { vi: "Pattern không hợp lệ:", en: "Invalid pattern:" },
  testTitle: { vi: "Chuỗi thử nghiệm", en: "Test string" },
  testSubtitle: {
    vi: "Các đoạn khớp được tô sáng bên dưới",
    en: "Matched segments are highlighted below",
  },
  testLabel: { vi: "Văn bản", en: "Text" },
  highlightLabel: { vi: "Kết quả tô sáng", en: "Highlighted result" },
  matchesTitle: { vi: "Danh sách kết quả", en: "Match list" },
  matchesWord: { vi: "kết quả", en: "matches" },
  matchWord: { vi: "kết quả", en: "match" },
  noMatches: { vi: "Không có kết quả khớp.", en: "No matches." },
  emptyState: {
    vi: "Nhập pattern và chuỗi thử để xem kết quả.",
    en: "Enter a pattern and a test string to see matches.",
  },
  matchCapNotice: {
    vi: `Đã dừng ở ${MATCH_CAP} kết quả đầu tiên.`,
    en: `Stopped at the first ${MATCH_CAP} matches.`,
  },
  listCapNotice: {
    vi: `Chỉ liệt kê ${LIST_CAP} kết quả đầu tiên.`,
    en: `Only the first ${LIST_CAP} matches are listed.`,
  },
  nonGlobalNote: {
    vi: "Không có cờ g — chỉ tìm kết quả đầu tiên.",
    en: "No g flag — only the first match is found.",
  },
  groupsHeader: { vi: "Nhóm", en: "Group" },
  valueHeader: { vi: "Giá trị", en: "Value" },
  replaceTitle: { vi: "Thay thế", en: "Replace preview" },
  replaceSubtitle: {
    vi: "Hỗ trợ $1, $<name> và $& trong chuỗi thay thế",
    en: "Supports $1, $<name> and $& in the replacement",
  },
  replacementLabel: { vi: "Chuỗi thay thế", en: "Replacement" },
  replaceResult: { vi: "Kết quả", en: "Result" },
  replaceError: {
    vi: "Không thể thay thế với chuỗi này.",
    en: "Cannot apply this replacement string.",
  },
  refTitle: { vi: "Tra cứu nhanh", en: "Quick reference" },
  refSubtitle: { vi: "Các token thường dùng", en: "Common tokens" },
  expand: { vi: "Mở rộng", en: "Expand" },
  collapse: { vi: "Thu gọn", en: "Collapse" },
  snippetTitle: { vi: "Mã nguồn mẫu", en: "Code snippet" },
  snippetSubtitle: {
    vi: "Sinh mã từ pattern hiện tại",
    en: "Generated from the current pattern",
  },
} satisfies Record<string, Localized>;

const FLAGS = ["g", "i", "m", "s", "u", "y"] as const;
type Flag = (typeof FLAGS)[number];

const FLAG_INFO = {
  g: { vi: "global — tìm tất cả kết quả", en: "global — find all matches" },
  i: { vi: "ignore case — không phân biệt hoa thường", en: "ignore case — case-insensitive matching" },
  m: { vi: "multiline — ^ và $ khớp từng dòng", en: "multiline — ^ and $ match per line" },
  s: { vi: "dotAll — dấu . khớp cả xuống dòng", en: "dotAll — . also matches newlines" },
  u: { vi: "unicode — bật chế độ Unicode đầy đủ", en: "unicode — full Unicode mode" },
  y: { vi: "sticky — chỉ khớp từ vị trí lastIndex", en: "sticky — match only at lastIndex" },
} satisfies Record<Flag, Localized>;

interface RefEntry {
  token: string;
  meaning: Localized;
}

const QUICK_REF: RefEntry[] = [
  { token: "\\d", meaning: { vi: "chữ số 0–9", en: "digit 0–9" } },
  { token: "\\D", meaning: { vi: "không phải chữ số", en: "non-digit" } },
  { token: "\\w", meaning: { vi: "chữ, số hoặc _", en: "word char (letter, digit, _)" } },
  { token: "\\W", meaning: { vi: "không phải chữ, số, _", en: "non-word char" } },
  { token: "\\s", meaning: { vi: "khoảng trắng", en: "whitespace" } },
  { token: "\\S", meaning: { vi: "không phải khoảng trắng", en: "non-whitespace" } },
  { token: ".", meaning: { vi: "ký tự bất kỳ (trừ xuống dòng)", en: "any char (except newline)" } },
  { token: "^", meaning: { vi: "đầu chuỗi / đầu dòng", en: "start of string / line" } },
  { token: "$", meaning: { vi: "cuối chuỗi / cuối dòng", en: "end of string / line" } },
  { token: "\\b", meaning: { vi: "ranh giới từ", en: "word boundary" } },
  { token: "[abc]", meaning: { vi: "một trong a, b, c", en: "any of a, b, c" } },
  { token: "[^abc]", meaning: { vi: "khác a, b, c", en: "none of a, b, c" } },
  { token: "a|b", meaning: { vi: "a hoặc b", en: "a or b" } },
  { token: "a*", meaning: { vi: "0 lần trở lên", en: "0 or more times" } },
  { token: "a+", meaning: { vi: "1 lần trở lên", en: "1 or more times" } },
  { token: "a?", meaning: { vi: "0 hoặc 1 lần", en: "0 or 1 time" } },
  { token: "a{2,4}", meaning: { vi: "từ 2 đến 4 lần", en: "2 to 4 times" } },
  { token: "(…)", meaning: { vi: "nhóm bắt", en: "capturing group" } },
  { token: "(?<name>…)", meaning: { vi: "nhóm có tên", en: "named group" } },
  { token: "(?:…)", meaning: { vi: "nhóm không bắt", en: "non-capturing group" } },
  { token: "(?=…)", meaning: { vi: "lookahead (đứng trước)", en: "lookahead" } },
  { token: "(?!…)", meaning: { vi: "lookahead phủ định", en: "negative lookahead" } },
  { token: "\\1", meaning: { vi: "tham chiếu nhóm 1", en: "backreference to group 1" } },
];

const SNIPPET_TABS: ReadonlyArray<{ value: SnippetLang; label: string }> = [
  { value: "javascript", label: "JavaScript" },
  { value: "java", label: "Java" },
  { value: "python", label: "Python" },
];

const SAMPLE_PATTERN = "(?<user>[\\w.-]+)@(?<domain>[\\w-]+\\.\\w{2,})";
const SAMPLE_TEXT = `Liên hệ / Contact:
- nam.tran@example.com
- support@devtility.dev (24/7)
- hotline: 0909-123-456
Ngày tạo / Created: 2026-07-23`;

function useDebouncedValue<T>(value: T, delay = 250): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

interface MatchInfo {
  start: number;
  end: number;
  value: string;
  groups: (string | undefined)[];
  named: [string, string | undefined][];
}

interface MatchResult {
  matches: MatchInfo[];
  capped: boolean;
}

function toMatchInfo(m: RegExpExecArray): MatchInfo {
  return {
    start: m.index,
    end: m.index + m[0].length,
    value: m[0],
    groups: m.slice(1),
    named: m.groups ? Object.entries(m.groups) : [],
  };
}

/** Run the regex over the text; manual lastIndex advance protects zero-width matches. */
function collectMatches(source: string, flags: string, text: string): MatchResult {
  const re = new RegExp(source, flags);
  if (!re.global) {
    const m = re.exec(text);
    return { matches: m ? [toMatchInfo(m)] : [], capped: false };
  }
  const matches: MatchInfo[] = [];
  let capped = false;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (matches.length >= MATCH_CAP) {
      capped = true;
      break;
    }
    matches.push(toMatchInfo(m));
    if (m[0].length === 0) re.lastIndex += 1; // zero-width protection
  }
  return { matches, capped };
}

function truncateValue(value: string, max = 120): string {
  return value.length > max ? `${value.slice(0, max)}…` : value;
}

function FlagChips({ flags, onToggle, t }: {
  flags: string;
  onToggle: (flag: Flag) => void;
  t: (text: Localized) => string;
}) {
  return (
    <div className="flex items-center gap-1">
      {FLAGS.map((flag) => {
        const active = flags.includes(flag);
        return (
          <button
            key={flag}
            type="button"
            aria-pressed={active}
            title={`${flag} — ${t(FLAG_INFO[flag])}`}
            onClick={() => onToggle(flag)}
            className={cn(
              "h-8 w-8 shrink-0 rounded-lg border font-mono text-sm font-semibold transition-colors",
              active
                ? "border-primary/40 bg-primary/10 text-primary"
                : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground",
            )}
          >
            {flag}
          </button>
        );
      })}
    </div>
  );
}

function HighlightedText({ text, matches }: { text: string; matches: MatchInfo[] }) {
  const parts: ReactNode[] = [];
  let cursor = 0;
  matches.forEach((m, i) => {
    if (m.start > cursor) parts.push(text.slice(cursor, m.start));
    parts.push(
      <span key={i} className={cn("rounded-sm", i % 2 === 0 ? "bg-primary/20" : "bg-accent/20")}>
        {m.value}
      </span>,
    );
    cursor = Math.max(cursor, m.end);
  });
  if (cursor < text.length) parts.push(text.slice(cursor));
  return (
    <pre className="max-h-80 overflow-y-auto whitespace-pre-wrap break-words rounded-lg border border-border bg-muted/50 px-3 py-2 font-mono text-sm leading-relaxed">
      {parts}
    </pre>
  );
}

function GroupTable({ match, t }: { match: MatchInfo; t: (text: Localized) => string }) {
  if (match.groups.length === 0 && match.named.length === 0) return null;
  return (
    <table className="mt-2 w-full text-xs">
      <thead>
        <tr className="text-left text-muted-foreground">
          <th className="w-28 py-0.5 pr-2 font-medium">{t(M.groupsHeader)}</th>
          <th className="py-0.5 font-medium">{t(M.valueHeader)}</th>
        </tr>
      </thead>
      <tbody>
        {match.groups.map((value, i) => (
          <tr key={`g${i}`} className="border-t border-border/60">
            <td className="py-1 pr-2 font-mono text-primary">${i + 1}</td>
            <td className="min-w-0 py-1">
              {value === undefined ? (
                <span className="text-muted-foreground">—</span>
              ) : (
                <span className="break-all font-mono">{truncateValue(value)}</span>
              )}
            </td>
          </tr>
        ))}
        {match.named.map(([name, value]) => (
          <tr key={`n${name}`} className="border-t border-border/60">
            <td className="py-1 pr-2 font-mono text-accent">{name}</td>
            <td className="min-w-0 py-1">
              {value === undefined ? (
                <span className="text-muted-foreground">—</span>
              ) : (
                <span className="break-all font-mono">{truncateValue(value)}</span>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default function RegexTesterTool() {
  const { lang, t } = useI18n();

  const [pattern, setPattern] = useState(SAMPLE_PATTERN);
  const [flags, setFlags] = useState("g");
  const [testString, setTestString] = useState(SAMPLE_TEXT);
  const [replacement, setReplacement] = useState("");
  const [refOpen, setRefOpen] = useState(false);
  const [snippetLang, setSnippetLang] = useState<SnippetLang>("javascript");

  const debouncedPattern = useDebouncedValue(pattern);
  const debouncedText = useDebouncedValue(testString);
  const debouncedReplacement = useDebouncedValue(replacement);

  const toggleFlag = (flag: Flag) => {
    setFlags((prev) => (prev.includes(flag) ? prev.replace(flag, "") : prev + flag));
  };

  const compiled = useMemo((): { error: string } | { source: string; flags: string } | null => {
    if (debouncedPattern === "") return null;
    try {
      // Compile once to validate pattern + flags.
      void new RegExp(debouncedPattern, flags);
      return { source: debouncedPattern, flags };
    } catch (err) {
      return { error: err instanceof Error ? err.message : String(err) };
    }
  }, [debouncedPattern, flags]);

  const result = useMemo((): MatchResult | null => {
    if (compiled === null || "error" in compiled) return null;
    try {
      return collectMatches(compiled.source, compiled.flags, debouncedText);
    } catch {
      return null;
    }
  }, [compiled, debouncedText]);

  const replaceOutput = useMemo((): { value: string } | { error: true } | null => {
    if (compiled === null || "error" in compiled) return null;
    try {
      const re = new RegExp(compiled.source, compiled.flags);
      return { value: debouncedText.replace(re, debouncedReplacement) };
    } catch {
      return { error: true };
    }
  }, [compiled, debouncedText, debouncedReplacement]);

  const snippet = useMemo(() => {
    if (compiled === null || "error" in compiled) return null;
    return buildSnippet(snippetLang, compiled.source, compiled.flags, debouncedReplacement);
  }, [compiled, snippetLang, debouncedReplacement]);

  const matches = result?.matches ?? [];
  const listed = matches.slice(0, LIST_CAP);
  const countLabel =
    lang === "vi"
      ? `${matches.length} ${t(M.matchesWord)}`
      : `${matches.length} ${matches.length === 1 ? t(M.matchWord) : t(M.matchesWord)}`;

  return (
    <div className="space-y-4">
      <Card className="animate-fade-up">
        <CardHeader
          title={
            <span className="inline-flex items-center gap-2">
              <Regex className="h-4 w-4 text-primary" aria-hidden />
              {t(M.patternTitle)}
            </span>
          }
          subtitle={t(M.patternSubtitle)}
        />
        <CardBody className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex min-w-0 flex-1 items-center gap-1.5">
              <span className="select-none font-mono text-lg text-muted-foreground">/</span>
              <TextInput
                aria-label={t(M.patternTitle)}
                className="min-w-0 flex-1 font-mono"
                spellCheck={false}
                autoComplete="off"
                placeholder={t(M.patternPlaceholder)}
                value={pattern}
                onChange={(e) => setPattern(e.target.value)}
              />
              <span className="select-none font-mono text-lg text-muted-foreground">/</span>
            </div>
            <FlagChips flags={flags} onToggle={toggleFlag} t={t} />
          </div>
          {compiled !== null && "error" in compiled ? (
            <p className="rounded-lg bg-danger/10 px-4 py-3 text-sm text-danger">
              {t(M.invalidPattern)} <span className="break-all font-mono text-xs">{compiled.error}</span>
            </p>
          ) : null}
        </CardBody>
      </Card>

      <div className="grid items-start gap-4 lg:grid-cols-2">
        <Card className="animate-fade-up">
          <CardHeader title={t(M.testTitle)} subtitle={t(M.testSubtitle)} />
          <CardBody className="space-y-3">
            <Field label={t(M.testLabel)} htmlFor="regex-test-string">
              <TextArea
                id="regex-test-string"
                className="min-h-32"
                spellCheck={false}
                value={testString}
                onChange={(e) => setTestString(e.target.value)}
              />
            </Field>
            <div>
              <p className="mb-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {t(M.highlightLabel)}
              </p>
              {compiled === null || "error" in compiled || result === null ? (
                <p className="rounded-lg bg-muted px-4 py-4 text-center text-sm text-muted-foreground">
                  {t(M.emptyState)}
                </p>
              ) : (
                <HighlightedText text={debouncedText} matches={matches} />
              )}
            </div>
            {result?.capped ? (
              <p className="rounded-lg bg-warning/10 px-3 py-2 text-xs text-warning">{t(M.matchCapNotice)}</p>
            ) : null}
            {compiled !== null && !("error" in compiled) && !flags.includes("g") ? (
              <p className="text-xs text-muted-foreground">{t(M.nonGlobalNote)}</p>
            ) : null}
          </CardBody>
        </Card>

        <Card className="animate-fade-up">
          <CardHeader
            title={t(M.matchesTitle)}
            subtitle={compiled !== null && !("error" in compiled) && result !== null ? countLabel : undefined}
          />
          <CardBody>
            {compiled === null || "error" in compiled || result === null ? (
              <p className="rounded-lg bg-muted px-4 py-4 text-center text-sm text-muted-foreground">
                {t(M.emptyState)}
              </p>
            ) : matches.length === 0 ? (
              <p className="rounded-lg bg-muted px-4 py-4 text-center text-sm text-muted-foreground">
                {t(M.noMatches)}
              </p>
            ) : (
              <div className="max-h-[28rem] space-y-2 overflow-y-auto pr-1">
                {matches.length > LIST_CAP ? (
                  <p className="rounded-lg bg-warning/10 px-3 py-2 text-xs text-warning">{t(M.listCapNotice)}</p>
                ) : null}
                {listed.map((m, i) => (
                  <div key={i} className="rounded-lg border border-border px-3 py-2">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                      <span className="font-mono font-semibold text-primary">#{i + 1}</span>
                      <span className="font-mono text-muted-foreground">
                        [{m.start}–{m.end})
                      </span>
                      <span className="min-w-0 flex-1 truncate font-mono text-sm text-foreground">
                        {m.value === "" ? <span className="text-muted-foreground">∅</span> : m.value}
                      </span>
                    </div>
                    <GroupTable match={m} t={t} />
                  </div>
                ))}
              </div>
            )}
          </CardBody>
        </Card>
      </div>

      <Card className="animate-fade-up">
        <CardHeader
          title={
            <span className="inline-flex items-center gap-2">
              <Replace className="h-4 w-4 text-primary" aria-hidden />
              {t(M.replaceTitle)}
            </span>
          }
          subtitle={t(M.replaceSubtitle)}
        />
        <CardBody className="space-y-3">
          <Field label={t(M.replacementLabel)} htmlFor="regex-replacement">
            <TextInput
              id="regex-replacement"
              className="font-mono"
              spellCheck={false}
              autoComplete="off"
              placeholder="$<user> — $1"
              value={replacement}
              onChange={(e) => setReplacement(e.target.value)}
            />
          </Field>
          {replaceOutput === null ? (
            <p className="rounded-lg bg-muted px-4 py-4 text-center text-sm text-muted-foreground">
              {t(M.emptyState)}
            </p>
          ) : "error" in replaceOutput ? (
            <p className="rounded-lg bg-danger/10 px-4 py-3 text-sm text-danger">{t(M.replaceError)}</p>
          ) : (
            <div>
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  {t(M.replaceResult)}
                </p>
                <CopyButton text={replaceOutput.value} />
              </div>
              <pre className="max-h-64 overflow-y-auto whitespace-pre-wrap break-words rounded-lg border border-border bg-muted/50 px-3 py-2 font-mono text-sm leading-relaxed">
                {replaceOutput.value}
              </pre>
            </div>
          )}
        </CardBody>
      </Card>

      <Card className="animate-fade-up">
        <CardHeader
          title={
            <span className="inline-flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-primary" aria-hidden />
              {t(M.refTitle)}
            </span>
          }
          subtitle={t(M.refSubtitle)}
          actions={
            <button
              type="button"
              onClick={() => setRefOpen((v) => !v)}
              aria-expanded={refOpen}
              aria-label={refOpen ? t(M.collapse) : t(M.expand)}
              title={refOpen ? t(M.collapse) : t(M.expand)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              {refOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
          }
        />
        {refOpen ? (
          <CardBody>
            <div className="grid gap-x-4 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
              {QUICK_REF.map((entry) => (
                <div key={entry.token} className="flex items-baseline gap-2">
                  <code className="shrink-0 rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-primary">
                    {entry.token}
                  </code>
                  <span className="text-xs text-muted-foreground">{t(entry.meaning)}</span>
                </div>
              ))}
            </div>
          </CardBody>
        ) : null}
      </Card>

      <Card className="animate-fade-up">
        <CardHeader
          title={
            <span className="inline-flex items-center gap-2">
              <Code2 className="h-4 w-4 text-primary" aria-hidden />
              {t(M.snippetTitle)}
            </span>
          }
          subtitle={t(M.snippetSubtitle)}
          actions={snippet !== null ? <CopyButton text={snippet} /> : undefined}
        />
        <CardBody className="space-y-3">
          <Tabs items={SNIPPET_TABS} value={snippetLang} onChange={setSnippetLang} size="sm" />
          {snippet === null ? (
            <p className="rounded-lg bg-muted px-4 py-4 text-center text-sm text-muted-foreground">
              {t(M.emptyState)}
            </p>
          ) : (
            <pre className="overflow-x-auto rounded-lg border border-border bg-muted/50 px-4 py-3 font-mono text-xs leading-relaxed">
              {snippet}
            </pre>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
