"use client";

import { DateTime } from "luxon";
import { ArrowDownUp, Timer } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { CopyButton } from "@/components/ui/copy-button";
import { Field, Select, TextInput } from "@/components/ui/field";
import { Tabs } from "@/components/ui/tabs";
import { getTimeZones, zoneLabel } from "@/features/timezone/zones";
import type { Localized } from "@/lib/i18n";
import { useI18n } from "@/lib/i18n/use-lang";

type Unit = "auto" | "s" | "ms";

const M = {
  currentTitle: { vi: "Epoch hiện tại", en: "Current epoch" },
  currentSubtitle: {
    vi: "Cập nhật theo thời gian thực mỗi giây",
    en: "Updates in real time every second",
  },
  seconds: { vi: "Giây (s)", en: "Seconds (s)" },
  milliseconds: { vi: "Mili giây (ms)", en: "Milliseconds (ms)" },
  epochToDateTitle: { vi: "Epoch → Ngày giờ", en: "Epoch → Date & time" },
  epochToDateSubtitle: {
    vi: "Chuyển timestamp thành ngày giờ dễ đọc",
    en: "Convert a timestamp into a readable date",
  },
  epochValue: { vi: "Giá trị epoch", en: "Epoch value" },
  examplePrefix: { vi: "Ví dụ: ", en: "e.g. " },
  unit: { vi: "Đơn vị", en: "Unit" },
  enterEpoch: {
    vi: "Nhập giá trị epoch để xem kết quả.",
    en: "Enter an epoch value to see the result.",
  },
  detectedUnit: { vi: "Đơn vị nhận diện:", en: "Detected unit:" },
  localTime: { vi: "Giờ địa phương", en: "Local time" },
  relative: { vi: "Tương đối", en: "Relative" },
  dateToEpochTitle: { vi: "Ngày giờ → Epoch", en: "Date & time → Epoch" },
  dateToEpochSubtitle: {
    vi: "Chuyển ngày giờ thành timestamp",
    en: "Convert a date into a timestamp",
  },
  dateTime: { vi: "Ngày giờ", en: "Date & time" },
  timeZone: { vi: "Múi giờ", en: "Time zone" },
  enterDate: {
    vi: "Nhập ngày giờ để xem kết quả.",
    en: "Enter a date and time to see the result.",
  },
  errorInvalidValue: {
    vi: "Giá trị không hợp lệ. Vui lòng chỉ nhập chữ số (ví dụ: 1700000000).",
    en: "Invalid value. Please enter digits only (e.g. 1700000000).",
  },
  errorTooLarge: {
    vi: "Giá trị quá lớn, không thể xử lý.",
    en: "The value is too large to process.",
  },
  errorOutOfRange: {
    vi: "Giá trị nằm ngoài phạm vi ngày giờ hỗ trợ (khoảng ±270.000 năm).",
    en: "The value is outside the supported date range (about ±270,000 years).",
  },
  errorInvalidDate: {
    vi: "Ngày giờ không hợp lệ. Vui lòng kiểm tra lại giá trị đã nhập.",
    en: "Invalid date or time. Please check the entered value.",
  },
} satisfies Record<string, Localized>;

const UNIT_LABELS = {
  s: { vi: "giây (s)", en: "seconds (s)" },
  ms: { vi: "mili giây (ms)", en: "milliseconds (ms)" },
  us: { vi: "micro giây (µs)", en: "microseconds (µs)" },
} satisfies Record<string, Localized>;

const UNIT_TABS = [
  { value: "auto", label: { vi: "Tự động", en: "Auto" } },
  { value: "s", label: { vi: "Giây", en: "Seconds" } },
  { value: "ms", label: { vi: "Mili giây", en: "Milliseconds" } },
] as const;

interface Detection {
  ms: number;
  unitLabel: Localized;
}

/** Interpret a numeric epoch value according to the selected unit. */
function interpret(value: number, unit: Unit): Detection {
  if (unit === "s") return { ms: value * 1000, unitLabel: UNIT_LABELS.s };
  if (unit === "ms") return { ms: value, unitLabel: UNIT_LABELS.ms };
  const abs = Math.abs(value);
  if (abs < 1e11) return { ms: value * 1000, unitLabel: UNIT_LABELS.s };
  if (abs < 1e14) return { ms: value, unitLabel: UNIT_LABELS.ms };
  return { ms: value / 1000, unitLabel: UNIT_LABELS.us };
}

function OutputRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5">
      <span className="w-24 shrink-0 text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <span className="min-w-0 flex-1 break-all font-mono text-sm">{value}</span>
      <CopyButton text={value} />
    </div>
  );
}

function toInputValue(dt: DateTime): string {
  return dt.toFormat("yyyy-MM-dd'T'HH:mm:ss");
}

export default function EpochTool() {
  const { lang, t } = useI18n();
  const allZones = useMemo(() => getTimeZones(), []);
  const browserZone = useMemo(() => DateTime.local().zoneName ?? "Asia/Ho_Chi_Minh", []);

  const unitTabs = UNIT_TABS.map((item) => ({ value: item.value, label: t(item.label) }));

  // ---- Live current epoch -------------------------------------------------
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const now = DateTime.fromMillis(nowMs);
  const nowSec = Math.floor(nowMs / 1000);

  // ---- Epoch → date -------------------------------------------------------
  const [epochInput, setEpochInput] = useState("");
  const [unit, setUnit] = useState<Unit>("auto");

  const epochResult = useMemo((): { error: Localized } | { dt: DateTime; unitLabel: Localized } | null => {
    const raw = epochInput.trim().replace(/[\s_]/g, "");
    if (raw === "") return null;
    if (!/^-?\d+(\.\d+)?$/.test(raw)) {
      return { error: M.errorInvalidValue };
    }
    const value = Number(raw);
    if (!Number.isFinite(value)) {
      return { error: M.errorTooLarge };
    }
    const { ms, unitLabel } = interpret(value, unit);
    const dt = DateTime.fromMillis(ms);
    if (!dt.isValid) {
      return { error: M.errorOutOfRange };
    }
    return { dt, unitLabel };
  }, [epochInput, unit]);

  // ---- Date → epoch -------------------------------------------------------
  const [dateInput, setDateInput] = useState(() => toInputValue(DateTime.local()));
  const [dateZone, setDateZone] = useState(browserZone);

  const dateResult = useMemo((): { error: Localized } | { dt: DateTime } | null => {
    if (dateInput.trim() === "") return null;
    const dt = DateTime.fromISO(dateInput, { zone: dateZone });
    if (!dt.isValid) {
      return { error: M.errorInvalidDate };
    }
    return { dt };
  }, [dateInput, dateZone]);

  return (
    <div className="space-y-4">
      <Card className="animate-fade-up">
        <CardHeader
          title={t(M.currentTitle)}
          subtitle={t(M.currentSubtitle)}
        />
        <CardBody>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl bg-muted px-4 py-3">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{t(M.seconds)}</p>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <span className="break-all font-mono text-2xl font-semibold tabular-nums text-primary">
                  {nowSec}
                </span>
                <CopyButton text={String(nowSec)} />
              </div>
            </div>
            <div className="rounded-xl bg-muted px-4 py-3">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{t(M.milliseconds)}</p>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <span className="break-all font-mono text-2xl font-semibold tabular-nums text-primary">
                  {nowMs}
                </span>
                <CopyButton text={String(nowMs)} />
              </div>
            </div>
          </div>
          <p className="mt-3 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <Timer className="h-4 w-4 shrink-0" aria-hidden />
            {now.setLocale(lang).toFormat("cccc, dd/MM/yyyy HH:mm:ss")}
            <span className="font-mono text-xs">({now.zoneName})</span>
          </p>
        </CardBody>
      </Card>

      <div className="grid items-start gap-4 lg:grid-cols-2">
        <Card className="animate-fade-up">
          <CardHeader title={t(M.epochToDateTitle)} subtitle={t(M.epochToDateSubtitle)} />
          <CardBody className="space-y-4">
            <Field label={t(M.epochValue)} htmlFor="epoch-value">
              <TextInput
                id="epoch-value"
                inputMode="numeric"
                autoComplete="off"
                spellCheck={false}
                placeholder={`${t(M.examplePrefix)}${nowSec}`}
                className="font-mono"
                value={epochInput}
                onChange={(e) => setEpochInput(e.target.value)}
              />
            </Field>
            <div>
              <p className="mb-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">{t(M.unit)}</p>
              <Tabs items={unitTabs} value={unit} onChange={setUnit} size="sm" />
            </div>

            {epochResult === null ? (
              <p className="rounded-lg bg-muted px-4 py-4 text-center text-sm text-muted-foreground">
                {t(M.enterEpoch)}
              </p>
            ) : "error" in epochResult ? (
              <p className="rounded-lg bg-danger/10 px-4 py-3 text-sm text-danger">{t(epochResult.error)}</p>
            ) : (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">
                  {t(M.detectedUnit)}{" "}
                  <span className="font-medium text-foreground">{t(epochResult.unitLabel)}</span>
                </p>
                <div className="divide-y divide-border rounded-xl border border-border">
                  <OutputRow
                    label={t(M.localTime)}
                    value={`${epochResult.dt.setLocale(lang).toFormat("cccc, dd/MM/yyyy HH:mm:ss")} (${epochResult.dt.zoneName ?? ""})`}
                  />
                  <OutputRow label="UTC" value={epochResult.dt.toUTC().toFormat("dd/MM/yyyy HH:mm:ss 'UTC'")} />
                  <OutputRow label="ISO 8601" value={epochResult.dt.toISO() ?? "—"} />
                  <OutputRow label="RFC 2822" value={epochResult.dt.toRFC2822() ?? "—"} />
                  <OutputRow
                    label={t(M.relative)}
                    value={epochResult.dt.setLocale(lang).toRelative({ base: now }) ?? "—"}
                  />
                </div>
              </div>
            )}
          </CardBody>
        </Card>

        <Card className="animate-fade-up">
          <CardHeader title={t(M.dateToEpochTitle)} subtitle={t(M.dateToEpochSubtitle)} />
          <CardBody className="space-y-4">
            <Field label={t(M.dateTime)} htmlFor="epoch-date">
              <TextInput
                id="epoch-date"
                type="datetime-local"
                step={1}
                value={dateInput}
                onChange={(e) => setDateInput(e.target.value)}
              />
            </Field>
            <Field label={t(M.timeZone)} htmlFor="epoch-zone">
              <Select id="epoch-zone" value={dateZone} onChange={(e) => setDateZone(e.target.value)}>
                {allZones.map((z) => (
                  <option key={z} value={z}>
                    {zoneLabel(z)}
                  </option>
                ))}
              </Select>
            </Field>

            {dateResult === null ? (
              <p className="rounded-lg bg-muted px-4 py-4 text-center text-sm text-muted-foreground">
                {t(M.enterDate)}
              </p>
            ) : "error" in dateResult ? (
              <p className="rounded-lg bg-danger/10 px-4 py-3 text-sm text-danger">{t(dateResult.error)}</p>
            ) : (
              <div className="divide-y divide-border rounded-xl border border-border">
                <OutputRow label={t(M.seconds)} value={String(Math.floor(dateResult.dt.toMillis() / 1000))} />
                <OutputRow label={t(M.milliseconds)} value={String(dateResult.dt.toMillis())} />
                <div className="flex items-center gap-2 px-4 py-2.5 text-xs text-muted-foreground">
                  <ArrowDownUp className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  <span>
                    {dateResult.dt.setLocale(lang).toFormat("cccc, dd/MM/yyyy HH:mm:ss")} — UTC
                    {dateResult.dt.toFormat("ZZ")}
                  </span>
                </div>
              </div>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
