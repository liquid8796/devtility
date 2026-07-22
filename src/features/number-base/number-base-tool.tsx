"use client";

import { useMemo, useState, type ReactNode } from "react";

import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { CopyButton } from "@/components/ui/copy-button";
import { Field, Select, TextArea, TextInput } from "@/components/ui/field";
import { Tabs } from "@/components/ui/tabs";
import {
  bytesToText,
  convertBase,
  formatBytes,
  parseByteString,
  textToBytes,
  type ByteBase,
  type Result,
} from "@/lib/convert/number-base";
import type { Lang, Localized } from "@/lib/i18n";
import { useI18n } from "@/lib/i18n/use-lang";

// ---------------------------------------------------------------------------
// Messages
// ---------------------------------------------------------------------------

const M = {
  copy: { vi: "Sao chép", en: "Copy" },
  truncatedTitle: { vi: "Phần thập phân đã được cắt bớt", en: "The fractional part was truncated" },
  baseCardTitle: { vi: "Chuyển đổi hệ cơ số", en: "Number base converter" },
  baseCardSubtitle: {
    vi: "Nhị phân, bát phân, thập phân, thập lục phân và mọi hệ cơ số 2–36",
    en: "Binary, octal, decimal, hexadecimal and any base from 2 to 36",
  },
  value: { vi: "Giá trị", en: "Value" },
  valueHint: {
    vi: "Hỗ trợ số âm và phần thập phân, ví dụ: 255, -ff.8, 1010.101",
    en: "Supports negative numbers and fractions, e.g. 255, -ff.8, 1010.101",
  },
  valuePlaceholder: { vi: "Ví dụ: 255 hoặc 1010.101", en: "e.g. 255 or 1010.101" },
  sourceBase: { vi: "Hệ cơ số nguồn", en: "Source base" },
  customTab: { vi: "Khác", en: "Other" },
  customBaseField: { vi: "Cơ số (2–36)", en: "Base (2–36)" },
  invalidBaseRange: {
    vi: "Hệ cơ số phải là số nguyên từ 2 đến 36.",
    en: "The base must be an integer between 2 and 36.",
  },
  binary: { vi: "Nhị phân (2)", en: "Binary (2)" },
  octal: { vi: "Bát phân (8)", en: "Octal (8)" },
  decimal: { vi: "Thập phân (10)", en: "Decimal (10)" },
  hexadecimal: { vi: "Thập lục phân (16)", en: "Hexadecimal (16)" },
  customBaseRow: { vi: "Hệ tùy chọn", en: "Custom base" },
  customTargetBase: { vi: "Hệ cơ số đích tùy chọn", en: "Custom target base" },
  truncationNote: {
    vi: "… Phần thập phân được làm tròn tới tối đa 24 chữ số trong hệ cơ số đích.",
    en: "… The fractional part is rounded to at most 24 digits in the target base.",
  },
  bytesCardTitle: { vi: "Văn bản ⇄ ASCII/Bytes", en: "Text ⇄ ASCII/Bytes" },
  bytesCardSubtitle: {
    vi: "Mã hóa văn bản thành byte UTF-8 và giải mã ngược lại",
    en: "Encode text into UTF-8 bytes and decode it back",
  },
  encodeTab: { vi: "Văn bản → Số", en: "Text → Numbers" },
  decodeTab: { vi: "Số → Văn bản", en: "Numbers → Text" },
  text: { vi: "Văn bản", en: "Text" },
  textHint: {
    vi: "Nhập văn bản bất kỳ (hỗ trợ tiếng Việt, emoji…)",
    en: "Enter any text (Vietnamese, emoji… supported)",
  },
  textPlaceholder: { vi: "Ví dụ: Xin chào!", en: "e.g. Hello!" },
  byteCount: { vi: "Số byte (UTF-8):", en: "Byte count (UTF-8):" },
  byteBase: { vi: "Hệ cơ số", en: "Number base" },
  byteString: { vi: "Chuỗi byte", en: "Byte string" },
  byteHint: {
    vi: "Các byte cách nhau bằng khoảng trắng, ví dụ:",
    en: "Bytes separated by spaces, e.g.",
  },
  decodedText: { vi: "Văn bản giải mã", en: "Decoded text" },
} satisfies Record<string, Localized>;

// ---------------------------------------------------------------------------
// Display helpers
// ---------------------------------------------------------------------------

/** Group a digit string from the right ("11111111" → "1111 1111"). */
function groupFromRight(s: string, size: number, sep: string): string {
  const groups: string[] = [];
  for (let i = s.length; i > 0; i -= size) {
    groups.unshift(s.slice(Math.max(0, i - size), i));
  }
  return groups.join(sep);
}

/** Group a digit string from the left (fractional digits). */
function groupFromLeft(s: string, size: number, sep: string): string {
  const groups: string[] = [];
  for (let i = 0; i < s.length; i += size) {
    groups.push(s.slice(i, i + size));
  }
  return groups.join(sep);
}

/** Split a raw converted value into sign / integer / fraction. */
function splitValue(raw: string): { sign: string; int: string; frac: string } {
  const sign = raw.startsWith("-") ? "-" : "";
  const body = sign ? raw.slice(1) : raw;
  const dot = body.indexOf(".");
  return dot === -1
    ? { sign, int: body, frac: "" }
    : { sign, int: body.slice(0, dot), frac: body.slice(dot + 1) };
}

/** Binary display: nibble groups from the right of the integer part. */
function displayBinary(raw: string): string {
  const { sign, int, frac } = splitValue(raw);
  return sign + groupFromRight(int, 4, " ") + (frac ? "." + groupFromLeft(frac, 4, " ") : "");
}

/** Decimal display with language-matched grouping (vi: 1.234.567,89 / en: 1,234,567.89). */
function displayDecimal(raw: string, lang: Lang): string {
  const { sign, int, frac } = splitValue(raw);
  const groupSep = lang === "vi" ? "." : ",";
  const decimalSep = lang === "vi" ? "," : ".";
  return sign + groupFromRight(int, 3, groupSep) + (frac ? decimalSep + frac : "");
}

// ---------------------------------------------------------------------------
// Shared output row
// ---------------------------------------------------------------------------

function OutputRow({
  label,
  extra,
  result,
  format,
  copyTransform,
}: {
  label: Localized;
  extra?: ReactNode;
  result: Result | null;
  /** Raw value → pretty display string. */
  format?: (raw: string) => string;
  /** Raw value → clipboard string (defaults to the raw value). */
  copyTransform?: (raw: string) => string;
}) {
  const { t } = useI18n();
  const ok = result?.ok === true;
  const raw = ok && result.ok ? result.value : null;
  return (
    <div className="flex flex-col gap-1.5 rounded-lg border border-border bg-muted/40 px-3 py-2.5 sm:flex-row sm:items-center sm:gap-3">
      <div className="flex shrink-0 items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground sm:w-44">
        <span>{t(label)}</span>
        {extra}
      </div>
      <div className="min-w-0 flex-1 break-all font-mono text-sm text-foreground">
        {raw !== null ? (
          <>
            {format ? format(raw) : raw}
            {ok && result.ok && result.truncated ? (
              <span className="text-accent" title={t(M.truncatedTitle)}>
                …
              </span>
            ) : null}
          </>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </div>
      {raw !== null ? (
        <CopyButton
          text={copyTransform ? copyTransform(raw) : raw}
          label={t(M.copy)}
          className="self-start sm:self-auto"
        />
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Card 1 — base conversion
// ---------------------------------------------------------------------------

type BaseTab = "2" | "8" | "10" | "16" | "custom";

const BASE_TABS: ReadonlyArray<{ value: BaseTab; label: Localized }> = [
  { value: "2", label: { vi: "2", en: "2" } },
  { value: "8", label: { vi: "8", en: "8" } },
  { value: "10", label: { vi: "10", en: "10" } },
  { value: "16", label: { vi: "16", en: "16" } },
  { value: "custom", label: M.customTab },
];

const ALL_BASES = Array.from({ length: 35 }, (_, i) => i + 2);

function BaseConverterCard() {
  const { lang, t } = useI18n();
  const [value, setValue] = useState("");
  const [baseTab, setBaseTab] = useState<BaseTab>("10");
  const [customFrom, setCustomFrom] = useState("36");
  const [customTo, setCustomTo] = useState(36);

  const fromBase = useMemo(() => {
    if (baseTab !== "custom") return Number(baseTab);
    const n = Number(customFrom);
    return Number.isInteger(n) && n >= 2 && n <= 36 ? n : null;
  }, [baseTab, customFrom]);

  const hasInput = value.trim().length > 0;

  const results = useMemo(() => {
    if (!hasInput || fromBase === null) return null;
    return {
      bin: convertBase(value, fromBase, 2),
      oct: convertBase(value, fromBase, 8),
      dec: convertBase(value, fromBase, 10),
      hex: convertBase(value, fromBase, 16),
      custom: convertBase(value, fromBase, customTo),
    };
  }, [value, fromBase, customTo, hasInput]);

  const inputError: Localized | null =
    hasInput && fromBase === null
      ? M.invalidBaseRange
      : results && !results.bin.ok
        ? results.bin.error
        : null;

  const showRows = results !== null && results.bin.ok;
  const anyTruncated =
    showRows &&
    [results.bin, results.oct, results.dec, results.hex, results.custom].some(
      (r) => r.ok && r.truncated,
    );

  const baseTabItems = BASE_TABS.map((item) => ({ value: item.value, label: t(item.label) }));

  return (
    <Card>
      <CardHeader title={t(M.baseCardTitle)} subtitle={t(M.baseCardSubtitle)} />
      <CardBody className="space-y-4">
        <Field
          label={t(M.value)}
          htmlFor="nb-value"
          hint={!hasInput ? t(M.valueHint) : undefined}
        >
          <TextInput
            id="nb-value"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={t(M.valuePlaceholder)}
            className="font-mono"
            autoComplete="off"
            spellCheck={false}
          />
        </Field>

        <div className="flex flex-wrap items-end gap-3">
          <Field label={t(M.sourceBase)}>
            <Tabs items={baseTabItems} value={baseTab} onChange={setBaseTab} size="sm" />
          </Field>
          {baseTab === "custom" ? (
            <Field label={t(M.customBaseField)} htmlFor="nb-custom-from">
              <TextInput
                id="nb-custom-from"
                type="number"
                min={2}
                max={36}
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="w-24 font-mono"
              />
            </Field>
          ) : null}
        </div>

        {inputError ? <p className="text-sm text-danger">{t(inputError)}</p> : null}

        <div className="space-y-2">
          <OutputRow
            label={M.binary}
            result={showRows ? results.bin : null}
            format={displayBinary}
          />
          <OutputRow label={M.octal} result={showRows ? results.oct : null} />
          <OutputRow
            label={M.decimal}
            result={showRows ? results.dec : null}
            format={(raw) => displayDecimal(raw, lang)}
          />
          <OutputRow
            label={M.hexadecimal}
            result={showRows ? results.hex : null}
            format={(raw) => raw.toUpperCase()}
            copyTransform={(raw) => raw.toUpperCase()}
          />
          <OutputRow
            label={M.customBaseRow}
            extra={
              <Select
                aria-label={t(M.customTargetBase)}
                value={customTo}
                onChange={(e) => setCustomTo(Number(e.target.value))}
                className="h-8 w-20 pr-7 text-xs"
              >
                {ALL_BASES.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </Select>
            }
            result={showRows ? results.custom : null}
            format={(raw) => raw.toUpperCase()}
            copyTransform={(raw) => raw.toUpperCase()}
          />
        </div>

        {anyTruncated ? <p className="text-xs text-accent">{t(M.truncationNote)}</p> : null}
      </CardBody>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Card 2 — text ⇄ bytes
// ---------------------------------------------------------------------------

type Direction = "encode" | "decode";

const DIRECTION_TABS: ReadonlyArray<{ value: Direction; label: Localized }> = [
  { value: "encode", label: M.encodeTab },
  { value: "decode", label: M.decodeTab },
];

const BYTE_BASE_OPTIONS: ReadonlyArray<{ value: ByteBase; label: Localized; sample: string }> = [
  { value: 2, label: M.binary, sample: "01001000 01101001" },
  { value: 8, label: M.octal, sample: "110 151" },
  { value: 10, label: M.decimal, sample: "72 105" },
  { value: 16, label: M.hexadecimal, sample: "48 69" },
];

function ByteCount({ count }: { count: number }) {
  const { t } = useI18n();
  return (
    <p className="text-xs text-muted-foreground">
      {t(M.byteCount)} <span className="font-mono font-medium text-foreground">{count}</span>
    </p>
  );
}

function TextBytesCard() {
  const { t } = useI18n();
  const [direction, setDirection] = useState<Direction>("encode");
  const [text, setText] = useState("");
  const [byteInput, setByteInput] = useState("");
  const [byteBase, setByteBase] = useState<ByteBase>(16);

  // Mode A: text → bytes
  const encoded = useMemo(() => {
    if (!text) return null;
    const bytes = textToBytes(text);
    return {
      count: bytes.length,
      bin: formatBytes(bytes, 2),
      oct: formatBytes(bytes, 8),
      dec: formatBytes(bytes, 10),
      hex: formatBytes(bytes, 16),
    };
  }, [text]);

  // Mode B: bytes → text
  const decoded = useMemo(() => {
    if (!byteInput.trim()) return null;
    const parsed = parseByteString(byteInput, byteBase);
    if (!parsed.ok) return { error: parsed.error, count: 0, text: null };
    const res = bytesToText(parsed.bytes);
    return res.ok
      ? { error: null, count: parsed.bytes.length, text: res.value }
      : { error: res.error, count: parsed.bytes.length, text: null };
  }, [byteInput, byteBase]);

  const activeBase = BYTE_BASE_OPTIONS.find((o) => o.value === byteBase) ?? BYTE_BASE_OPTIONS[3];
  const directionTabItems = DIRECTION_TABS.map((item) => ({
    value: item.value,
    label: t(item.label),
  }));

  return (
    <Card>
      <CardHeader title={t(M.bytesCardTitle)} subtitle={t(M.bytesCardSubtitle)} />
      <CardBody className="space-y-4">
        <Tabs items={directionTabItems} value={direction} onChange={setDirection} size="sm" />

        {direction === "encode" ? (
          <>
            <Field
              label={t(M.text)}
              htmlFor="nb-text"
              hint={!text ? t(M.textHint) : undefined}
            >
              <TextArea
                id="nb-text"
                rows={3}
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={t(M.textPlaceholder)}
                className="font-sans"
              />
            </Field>
            {encoded ? (
              <>
                <ByteCount count={encoded.count} />
                <div className="space-y-2">
                  <OutputRow label={M.binary} result={{ ok: true, value: encoded.bin }} />
                  <OutputRow label={M.octal} result={{ ok: true, value: encoded.oct }} />
                  <OutputRow label={M.decimal} result={{ ok: true, value: encoded.dec }} />
                  <OutputRow label={M.hexadecimal} result={{ ok: true, value: encoded.hex }} />
                </div>
              </>
            ) : null}
          </>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-[12rem_1fr] sm:items-end">
              <Field label={t(M.byteBase)} htmlFor="nb-byte-base">
                <Select
                  id="nb-byte-base"
                  value={byteBase}
                  onChange={(e) => setByteBase(Number(e.target.value) as ByteBase)}
                >
                  {BYTE_BASE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {t(o.label)}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <Field
              label={t(M.byteString)}
              htmlFor="nb-bytes"
              hint={`${t(M.byteHint)} ${activeBase.sample}`}
            >
              <TextArea
                id="nb-bytes"
                rows={3}
                value={byteInput}
                onChange={(e) => setByteInput(e.target.value)}
                placeholder={activeBase.sample}
                spellCheck={false}
              />
            </Field>
            {decoded ? (
              decoded.error ? (
                <p className="text-sm text-danger">{t(decoded.error)}</p>
              ) : (
                <>
                  <ByteCount count={decoded.count} />
                  <div className="flex flex-col gap-1.5 rounded-lg border border-border bg-muted/40 px-3 py-2.5 sm:flex-row sm:items-center sm:gap-3">
                    <div className="shrink-0 text-xs font-medium uppercase tracking-wider text-muted-foreground sm:w-44">
                      {t(M.decodedText)}
                    </div>
                    <div className="min-w-0 flex-1 whitespace-pre-wrap break-words text-sm text-foreground">
                      {decoded.text}
                    </div>
                    <CopyButton
                      text={decoded.text ?? ""}
                      label={t(M.copy)}
                      className="self-start sm:self-auto"
                    />
                  </div>
                </>
              )
            ) : null}
          </>
        )}
      </CardBody>
    </Card>
  );
}

// ---------------------------------------------------------------------------

export default function NumberBaseTool() {
  return (
    <div className="space-y-6">
      <BaseConverterCard />
      <TextBytesCard />
    </div>
  );
}
