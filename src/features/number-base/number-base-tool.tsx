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

/** Decimal display with vi-VN grouping (1.234.567,89). */
function displayDecimalVN(raw: string): string {
  const { sign, int, frac } = splitValue(raw);
  return sign + groupFromRight(int, 3, ".") + (frac ? "," + frac : "");
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
  label: string;
  extra?: ReactNode;
  result: Result | null;
  /** Raw value → pretty display string. */
  format?: (raw: string) => string;
  /** Raw value → clipboard string (defaults to the raw value). */
  copyTransform?: (raw: string) => string;
}) {
  const ok = result?.ok === true;
  const raw = ok && result.ok ? result.value : null;
  return (
    <div className="flex flex-col gap-1.5 rounded-lg border border-border bg-muted/40 px-3 py-2.5 sm:flex-row sm:items-center sm:gap-3">
      <div className="flex shrink-0 items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground sm:w-44">
        <span>{label}</span>
        {extra}
      </div>
      <div className="min-w-0 flex-1 break-all font-mono text-sm text-foreground">
        {raw !== null ? (
          <>
            {format ? format(raw) : raw}
            {ok && result.ok && result.truncated ? (
              <span className="text-accent" title="Phần thập phân đã được cắt bớt">
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

const BASE_TABS: ReadonlyArray<{ value: BaseTab; label: string }> = [
  { value: "2", label: "2" },
  { value: "8", label: "8" },
  { value: "10", label: "10" },
  { value: "16", label: "16" },
  { value: "custom", label: "Khác" },
];

const ALL_BASES = Array.from({ length: 35 }, (_, i) => i + 2);

function BaseConverterCard() {
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

  const inputError =
    hasInput && fromBase === null
      ? "Hệ cơ số phải là số nguyên từ 2 đến 36."
      : results && !results.bin.ok
        ? results.bin.error
        : null;

  const showRows = results !== null && results.bin.ok;
  const anyTruncated =
    showRows &&
    [results.bin, results.oct, results.dec, results.hex, results.custom].some(
      (r) => r.ok && r.truncated,
    );

  return (
    <Card>
      <CardHeader
        title="Chuyển đổi hệ cơ số"
        subtitle="Nhị phân, bát phân, thập phân, thập lục phân và mọi hệ cơ số 2–36"
      />
      <CardBody className="space-y-4">
        <Field
          label="Giá trị"
          htmlFor="nb-value"
          hint={!hasInput ? "Hỗ trợ số âm và phần thập phân, ví dụ: 255, -ff.8, 1010.101" : undefined}
        >
          <TextInput
            id="nb-value"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Ví dụ: 255 hoặc 1010.101"
            className="font-mono"
            autoComplete="off"
            spellCheck={false}
          />
        </Field>

        <div className="flex flex-wrap items-end gap-3">
          <Field label="Hệ cơ số nguồn">
            <Tabs items={BASE_TABS} value={baseTab} onChange={setBaseTab} size="sm" />
          </Field>
          {baseTab === "custom" ? (
            <Field label="Cơ số (2–36)" htmlFor="nb-custom-from">
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

        {inputError ? <p className="text-sm text-danger">{inputError}</p> : null}

        <div className="space-y-2">
          <OutputRow
            label="Nhị phân (2)"
            result={showRows ? results.bin : null}
            format={displayBinary}
          />
          <OutputRow label="Bát phân (8)" result={showRows ? results.oct : null} />
          <OutputRow
            label="Thập phân (10)"
            result={showRows ? results.dec : null}
            format={displayDecimalVN}
          />
          <OutputRow
            label="Thập lục phân (16)"
            result={showRows ? results.hex : null}
            format={(raw) => raw.toUpperCase()}
            copyTransform={(raw) => raw.toUpperCase()}
          />
          <OutputRow
            label="Hệ tùy chọn"
            extra={
              <Select
                aria-label="Hệ cơ số đích tùy chọn"
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

        {anyTruncated ? (
          <p className="text-xs text-accent">
            … Phần thập phân được làm tròn tới tối đa 24 chữ số trong hệ cơ số đích.
          </p>
        ) : null}
      </CardBody>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Card 2 — text ⇄ bytes
// ---------------------------------------------------------------------------

type Direction = "encode" | "decode";

const DIRECTION_TABS: ReadonlyArray<{ value: Direction; label: string }> = [
  { value: "encode", label: "Văn bản → Số" },
  { value: "decode", label: "Số → Văn bản" },
];

const BYTE_BASE_OPTIONS: ReadonlyArray<{ value: ByteBase; label: string; sample: string }> = [
  { value: 2, label: "Nhị phân (2)", sample: "01001000 01101001" },
  { value: 8, label: "Bát phân (8)", sample: "110 151" },
  { value: 10, label: "Thập phân (10)", sample: "72 105" },
  { value: 16, label: "Thập lục phân (16)", sample: "48 69" },
];

function ByteCount({ count }: { count: number }) {
  return (
    <p className="text-xs text-muted-foreground">
      Số byte (UTF-8): <span className="font-mono font-medium text-foreground">{count}</span>
    </p>
  );
}

function TextBytesCard() {
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

  return (
    <Card>
      <CardHeader
        title="Văn bản ⇄ ASCII/Bytes"
        subtitle="Mã hóa văn bản thành byte UTF-8 và giải mã ngược lại"
      />
      <CardBody className="space-y-4">
        <Tabs items={DIRECTION_TABS} value={direction} onChange={setDirection} size="sm" />

        {direction === "encode" ? (
          <>
            <Field
              label="Văn bản"
              htmlFor="nb-text"
              hint={!text ? "Nhập văn bản bất kỳ (hỗ trợ tiếng Việt, emoji…)" : undefined}
            >
              <TextArea
                id="nb-text"
                rows={3}
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Ví dụ: Xin chào!"
                className="font-sans"
              />
            </Field>
            {encoded ? (
              <>
                <ByteCount count={encoded.count} />
                <div className="space-y-2">
                  <OutputRow label="Nhị phân (2)" result={{ ok: true, value: encoded.bin }} />
                  <OutputRow label="Bát phân (8)" result={{ ok: true, value: encoded.oct }} />
                  <OutputRow label="Thập phân (10)" result={{ ok: true, value: encoded.dec }} />
                  <OutputRow label="Thập lục phân (16)" result={{ ok: true, value: encoded.hex }} />
                </div>
              </>
            ) : null}
          </>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-[12rem_1fr] sm:items-end">
              <Field label="Hệ cơ số" htmlFor="nb-byte-base">
                <Select
                  id="nb-byte-base"
                  value={byteBase}
                  onChange={(e) => setByteBase(Number(e.target.value) as ByteBase)}
                >
                  {BYTE_BASE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <Field
              label="Chuỗi byte"
              htmlFor="nb-bytes"
              hint={`Các byte cách nhau bằng khoảng trắng, ví dụ: ${activeBase.sample}`}
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
                <p className="text-sm text-danger">{decoded.error}</p>
              ) : (
                <>
                  <ByteCount count={decoded.count} />
                  <div className="flex flex-col gap-1.5 rounded-lg border border-border bg-muted/40 px-3 py-2.5 sm:flex-row sm:items-center sm:gap-3">
                    <div className="shrink-0 text-xs font-medium uppercase tracking-wider text-muted-foreground sm:w-44">
                      Văn bản giải mã
                    </div>
                    <div className="min-w-0 flex-1 whitespace-pre-wrap break-words text-sm text-foreground">
                      {decoded.text}
                    </div>
                    <CopyButton text={decoded.text ?? ""} className="self-start sm:self-auto" />
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
