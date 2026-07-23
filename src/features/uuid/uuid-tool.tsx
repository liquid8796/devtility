"use client";

import { Check, Copy } from "lucide-react";
import { nanoid } from "nanoid";
import { ulid } from "ulid";
import { useEffect, useMemo, useRef, useState } from "react";
import { v4, v7, validate as uuidValidate, version as uuidVersion } from "uuid";

import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { CopyButton } from "@/components/ui/copy-button";
import { Field, TextInput } from "@/components/ui/field";
import { RefreshButton } from "@/components/ui/refresh-button";
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

  genTitle: { vi: "Trình tạo ID", en: "Generator" },
  genSubtitle: {
    vi: "Tạo UUID v4/v7, ULID và NanoID ngay trên trình duyệt",
    en: "Generate UUID v4/v7, ULID and NanoID right in the browser",
  },
  count: { vi: "Số lượng", en: "Count" },
  nanoLength: { vi: "Độ dài", en: "Length" },
  uppercase: { vi: "CHỮ HOA", en: "UPPERCASE" },
  generate: { vi: "Tạo", en: "Generate" },
  regenerate: { vi: "Tạo lại", en: "Regenerate" },
  copyAll: { vi: "Copy tất cả", en: "Copy all" },
  noteUuid4: {
    vi: "UUID v4: ngẫu nhiên hoàn toàn (122 bit) — lựa chọn phổ biến nhất.",
    en: "UUID v4: fully random (122 bits) — the most common choice.",
  },
  noteUuid7: {
    vi: "UUID v7: sắp xếp được theo thời gian — 48 bit đầu là mốc thời gian mili-giây.",
    en: "UUID v7: time-sortable — the first 48 bits are a millisecond timestamp.",
  },
  noteUlid: {
    vi: "ULID: 26 ký tự Crockford Base32 — sắp xếp theo thời gian, không có ký tự dễ nhầm (I, L, O, U).",
    en: "ULID: 26 Crockford Base32 characters — time-sortable, no ambiguous characters (I, L, O, U).",
  },
  noteNanoid: {
    vi: "NanoID: gọn và an toàn cho URL (A–Z, a–z, 0–9, _ và -).",
    en: "NanoID: compact and URL-safe (A–Z, a–z, 0–9, _ and -).",
  },

  inspectTitle: { vi: "Kiểm tra / Phân tích", en: "Validate / Inspect" },
  inspectSubtitle: {
    vi: "Dán một ID để tự động nhận diện loại và trích xuất thông tin",
    en: "Paste an id to auto-detect its type and extract details",
  },
  inspectInput: { vi: "ID cần kiểm tra", en: "Id to inspect" },
  inspectPlaceholder: {
    vi: "Ví dụ: 0198c2f0-… hoặc 01J8ME9RD6…",
    en: "e.g. 0198c2f0-… or 01J8ME9RD6…",
  },
  detectedType: { vi: "Loại", en: "Type" },
  version: { vi: "Phiên bản", en: "Version" },
  length: { vi: "Độ dài", en: "Length" },
  charsUnit: { vi: "ký tự", en: "chars" },
  timestamp: { vi: "Thời gian nhúng", en: "Embedded timestamp" },
  timestampNone: {
    vi: "Phiên bản này không chứa mốc thời gian.",
    en: "This version does not embed a timestamp.",
  },
  nanoidGuess: {
    vi: "Có thể là NanoID (21 ký tự thuộc bảng chữ cái mặc định). NanoID không có cấu trúc nên không thể xác thực chặt chẽ.",
    en: "Looks like a NanoID (21 characters from the default alphabet). NanoID has no structure, so it cannot be strictly validated.",
  },
  notRecognized: {
    vi: "Không nhận diện được — không phải UUID, ULID hay NanoID mặc định.",
    en: "Not recognized — not a UUID, ULID or default NanoID.",
  },
} satisfies Record<string, Localized>;

// ---------------------------------------------------------------------------
// Generation helpers
// ---------------------------------------------------------------------------

type GenType = "uuid4" | "uuid7" | "ulid" | "nanoid";

const GENERATORS: Record<GenType, (nanoLength: number) => string> = {
  uuid4: () => v4(),
  uuid7: () => v7(),
  ulid: () => ulid(),
  nanoid: (nanoLength) => nanoid(nanoLength),
};

const TYPE_LABELS: Record<GenType, string> = {
  uuid4: "UUID v4",
  uuid7: "UUID v7",
  ulid: "ULID",
  nanoid: "NanoID",
};

const TYPE_NOTES: Record<GenType, Localized> = {
  uuid4: M.noteUuid4,
  uuid7: M.noteUuid7,
  ulid: M.noteUlid,
  nanoid: M.noteNanoid,
};

function clampInt(raw: string, min: number, max: number, fallback: number): number {
  const n = Number.parseInt(raw, 10);
  if (Number.isNaN(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function generateIds(type: GenType, count: number, nanoLength: number): string[] {
  return Array.from({ length: count }, () => GENERATORS[type](nanoLength));
}

// ---------------------------------------------------------------------------
// Card 1 — Generator
// ---------------------------------------------------------------------------

/** Outline copy button with a visible custom label (e.g. "Copy all"). */
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

function GeneratorCard() {
  const { t, locale } = useI18n();
  const [genType, setGenType] = useState<GenType>("uuid4");
  const [countStr, setCountStr] = useState("1");
  const [nanoLenStr, setNanoLenStr] = useState("21");
  const [upper, setUpper] = useState(false);
  // Lazy initializer so the first id exists on mount without an effect
  // (registry loads this tool with ssr:false, so crypto is available here).
  const [generated, setGenerated] = useState<{ type: GenType; ids: string[] }>(() => ({
    type: "uuid4",
    ids: [v4()],
  }));

  const count = clampInt(countStr, 1, 1000, 1);
  const nanoLen = clampInt(nanoLenStr, 5, 64, 21);
  const isUuid = generated.type === "uuid4" || generated.type === "uuid7";

  const regenerate = (type: GenType) => {
    setGenerated({ type, ids: generateIds(type, count, nanoLen) });
  };

  const handleTypeChange = (type: GenType) => {
    setGenType(type);
    regenerate(type);
  };

  const displayIds = isUuid && upper ? generated.ids.map((id) => id.toUpperCase()) : generated.ids;
  const nf = new Intl.NumberFormat(locale);

  return (
    <Card>
      <CardHeader
        title={t(M.genTitle)}
        subtitle={t(M.genSubtitle)}
        actions={
          <>
            <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
              {nf.format(displayIds.length)}
            </span>
            <LabeledCopyButton text={displayIds.join("\n")} label={t(M.copyAll)} />
          </>
        }
      />
      <CardBody className="space-y-4">
        <Tabs
          items={(Object.keys(TYPE_LABELS) as GenType[]).map((type) => ({
            value: type,
            label: TYPE_LABELS[type],
          }))}
          value={genType}
          onChange={handleTypeChange}
          size="sm"
        />

        <div className="flex flex-wrap items-end gap-3">
          <Field label={t(M.count)} htmlFor="gen-count">
            <TextInput
              id="gen-count"
              type="number"
              min={1}
              max={1000}
              value={countStr}
              onChange={(e) => setCountStr(e.target.value)}
              onBlur={() => setCountStr(String(count))}
              className="w-24 font-mono"
            />
          </Field>
          {genType === "nanoid" ? (
            <Field label={t(M.nanoLength)} htmlFor="gen-nano-length">
              <TextInput
                id="gen-nano-length"
                type="number"
                min={5}
                max={64}
                value={nanoLenStr}
                onChange={(e) => setNanoLenStr(e.target.value)}
                onBlur={() => setNanoLenStr(String(nanoLen))}
                className="w-24 font-mono"
              />
            </Field>
          ) : null}
          {genType === "uuid4" || genType === "uuid7" ? (
            <Button
              variant={upper ? "primary" : "outline"}
              size="sm"
              aria-pressed={upper}
              onClick={() => setUpper((v) => !v)}
              className="h-10"
            >
              {t(M.uppercase)}
            </Button>
          ) : null}
          <div className="flex items-center gap-1">
            <Button onClick={() => regenerate(genType)} className="h-10">
              {t(M.generate)}
            </Button>
            <RefreshButton onClick={() => regenerate(genType)} label={t(M.regenerate)} />
          </div>
        </div>

        <ul className="max-h-72 space-y-1.5 overflow-y-auto pr-1">
          {displayIds.map((id, i) => (
            <li
              key={`${i}-${id}`}
              className="flex items-center gap-3 rounded-lg border border-border bg-muted/40 px-3 py-2"
            >
              <span className="w-8 shrink-0 text-right font-mono text-xs text-muted-foreground">
                {i + 1}
              </span>
              <span className="min-w-0 flex-1 break-all font-mono text-sm">{id}</span>
              <CopyButton text={id} label={t(M.copy)} className="shrink-0" />
            </li>
          ))}
        </ul>

        <p className="text-xs text-muted-foreground">{t(TYPE_NOTES[generated.type])}</p>
      </CardBody>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Card 2 — Validate / Inspect
// ---------------------------------------------------------------------------

const ULID_RE = /^[0-9A-HJKMNP-TV-Z]{26}$/i;
const NANOID_RE = /^[A-Za-z0-9_-]{21}$/;
const CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

/** Decode the 10-char Crockford Base32 time part of a ULID → ms epoch. */
function decodeUlidTime(id: string): number {
  let ms = 0;
  for (const ch of id.slice(0, 10).toUpperCase()) {
    ms = ms * 32 + CROCKFORD.indexOf(ch);
  }
  return ms;
}

/** Extract the ms-epoch timestamp embedded in a UUID, when the version has one. */
function uuidTimestamp(id: string, ver: number): number | null {
  const hex = id.replace(/-/g, "").toLowerCase();
  if (ver === 7) {
    // First 48 bits = ms since Unix epoch.
    return Number.parseInt(hex.slice(0, 12), 16);
  }
  if (ver === 1) {
    // 60-bit count of 100ns intervals since 1582-10-15 (Gregorian reform).
    const intervals = BigInt(`0x${hex.slice(13, 16)}${hex.slice(8, 12)}${hex.slice(0, 8)}`);
    return Number(intervals / BigInt(10000)) - 12219292800000;
  }
  return null;
}

type Inspection =
  | { kind: "uuid"; version: number; timestamp: number | null; length: number }
  | { kind: "ulid"; timestamp: number; length: number }
  | { kind: "nanoid"; length: number }
  | { kind: "unknown" };

function inspectId(raw: string): Inspection | null {
  const s = raw.trim();
  if (!s) return null;
  if (uuidValidate(s)) {
    const ver = uuidVersion(s);
    return { kind: "uuid", version: ver, timestamp: uuidTimestamp(s, ver), length: s.length };
  }
  if (ULID_RE.test(s)) {
    return { kind: "ulid", timestamp: decodeUlidTime(s), length: s.length };
  }
  if (NANOID_RE.test(s)) {
    return { kind: "nanoid", length: s.length };
  }
  return { kind: "unknown" };
}

function DetailRow({ label, children }: { label: Localized; children: React.ReactNode }) {
  const { t } = useI18n();
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-border bg-muted/40 px-3 py-2.5 sm:flex-row sm:items-center sm:gap-3">
      <div className="shrink-0 text-xs font-medium uppercase tracking-wider text-muted-foreground sm:w-44">
        {t(label)}
      </div>
      <div className="min-w-0 flex-1 break-all text-sm">{children}</div>
    </div>
  );
}

function InspectorCard() {
  const { t, locale } = useI18n();
  const [input, setInput] = useState("");

  const inspection = useMemo(() => inspectId(input), [input]);

  const formatTimestamp = (ms: number): string | null => {
    if (!Number.isFinite(ms) || Math.abs(ms) > 8.64e15) return null;
    const formatted = new Intl.DateTimeFormat(locale, {
      dateStyle: "medium",
      timeStyle: "long",
    }).format(new Date(ms));
    return `${formatted} (${ms} ms)`;
  };

  const badgeLabel =
    inspection === null || inspection.kind === "unknown"
      ? null
      : inspection.kind === "uuid"
        ? `UUID v${inspection.version}`
        : inspection.kind === "ulid"
          ? "ULID"
          : "NanoID?";

  return (
    <Card>
      <CardHeader title={t(M.inspectTitle)} subtitle={t(M.inspectSubtitle)} />
      <CardBody className="space-y-4">
        <Field label={t(M.inspectInput)} htmlFor="inspect-input">
          <TextInput
            id="inspect-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={t(M.inspectPlaceholder)}
            className="font-mono"
            autoComplete="off"
            spellCheck={false}
          />
        </Field>

        {inspection?.kind === "unknown" ? (
          <p className="text-sm text-danger">{t(M.notRecognized)}</p>
        ) : null}

        {badgeLabel && inspection && inspection.kind !== "unknown" ? (
          <div className="space-y-2">
            <DetailRow label={M.detectedType}>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-success/10 px-2.5 py-0.5 text-xs font-medium text-success">
                <Check className="h-3.5 w-3.5" />
                {badgeLabel}
              </span>
            </DetailRow>
            <DetailRow label={M.length}>
              <span className="font-mono">{inspection.length}</span>{" "}
              <span className="text-muted-foreground">{t(M.charsUnit)}</span>
            </DetailRow>
            {inspection.kind === "uuid" ? (
              <DetailRow label={M.version}>
                <span className="font-mono">v{inspection.version}</span>
              </DetailRow>
            ) : null}
            {inspection.kind === "uuid" || inspection.kind === "ulid" ? (
              <DetailRow label={M.timestamp}>
                {inspection.timestamp !== null && formatTimestamp(inspection.timestamp) !== null ? (
                  <span className="font-mono">{formatTimestamp(inspection.timestamp)}</span>
                ) : (
                  <span className="text-muted-foreground">{t(M.timestampNone)}</span>
                )}
              </DetailRow>
            ) : null}
            {inspection.kind === "nanoid" ? (
              <p className="text-xs text-muted-foreground">{t(M.nanoidGuess)}</p>
            ) : null}
          </div>
        ) : null}
      </CardBody>
    </Card>
  );
}

// ---------------------------------------------------------------------------

export default function UuidTool() {
  return (
    <div className="space-y-6">
      <GeneratorCard />
      <InspectorCard />
    </div>
  );
}
