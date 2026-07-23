"use client";

import { CronExpressionParser } from "cron-parser";
import cronstrue from "cronstrue";
import "cronstrue/locales/vi";
import { AlarmClock, CalendarClock, SlidersHorizontal, Sparkles } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/copy-button";
import { Field, Select, TextInput } from "@/components/ui/field";
import type { Localized } from "@/lib/i18n";
import { useI18n } from "@/lib/i18n/use-lang";
import { cn } from "@/lib/utils";

import {
  FIELD_ORDER,
  FIELD_RANGE,
  builderFromTokens,
  composeExpression,
  defaultBuilderState,
  specificListValid,
  splitTokens,
  type BuilderState,
  type FieldKey,
  type FieldMode,
  type FieldState,
} from "./expression";

const M = {
  exprTitle: { vi: "Biểu thức cron", en: "Cron expression" },
  exprSubtitle: {
    vi: "Nhập biểu thức hoặc chọn mẫu bên dưới",
    en: "Type an expression or pick a preset below",
  },
  withSeconds: { vi: "Có giây (6 trường)", en: "With seconds (6 fields)" },
  emptyExpr: {
    vi: "Nhập biểu thức cron để xem giải thích.",
    en: "Enter a cron expression to see the explanation.",
  },
  invalidExpr: {
    vi: "Biểu thức cron không hợp lệ.",
    en: "Invalid cron expression.",
  },
  presets: { vi: "Mẫu nhanh", en: "Quick presets" },
  builderTitle: { vi: "Trình dựng trực quan", en: "Visual builder" },
  builderSubtitle: {
    vi: "Chọn chế độ cho từng trường — biểu thức được cập nhật ngay",
    en: "Pick a mode per field — the expression updates instantly",
  },
  nextRunsTitle: { vi: "Lần chạy tiếp theo", en: "Next runs" },
  nextRunsSubtitle: {
    vi: "10 thời điểm kích hoạt kế tiếp theo múi giờ đã chọn",
    en: "The next 10 trigger times in the selected time zone",
  },
  timezone: { vi: "Múi giờ", en: "Time zone" },
  copyExpr: { vi: "Sao chép biểu thức", en: "Copy expression" },
  noRuns: {
    vi: "Không tính được lần chạy tiếp theo cho biểu thức này.",
    en: "Could not compute upcoming runs for this expression.",
  },
  fixExprFirst: {
    vi: "Sửa biểu thức hợp lệ để xem các lần chạy tiếp theo.",
    en: "Fix the expression to see the upcoming runs.",
  },
  browserZone: { vi: "Múi giờ trình duyệt", en: "Browser time zone" },
  specificPlaceholder: { vi: "vd: 0,15,30", en: "e.g. 0,15,30" },
  specificInvalid: {
    vi: "Danh sách số cách nhau bởi dấu phẩy, trong khoảng cho phép.",
    en: "Comma-separated numbers within the allowed range.",
  },
  from: { vi: "Từ", en: "From" },
  to: { vi: "Đến", en: "To" },
  stepEvery: { vi: "Mỗi n", en: "Every n" },
  customHint: {
    vi: "Cú pháp nâng cao — chỉnh trực tiếp trong ô biểu thức.",
    en: "Advanced syntax — edit it in the expression box directly.",
  },
} satisfies Record<string, Localized>;

const FIELD_LABEL: Record<FieldKey, Localized> = {
  minute: { vi: "Phút", en: "Minute" },
  hour: { vi: "Giờ", en: "Hour" },
  dayOfMonth: { vi: "Ngày", en: "Day of month" },
  month: { vi: "Tháng", en: "Month" },
  dayOfWeek: { vi: "Thứ", en: "Day of week" },
};

const MODE_LABEL: Record<FieldMode, Localized> = {
  every: { vi: "Mỗi (*)", en: "Every (*)" },
  specific: { vi: "Cụ thể", en: "Specific" },
  range: { vi: "Khoảng", en: "Range" },
  step: { vi: "Bước (*/n)", en: "Step (*/n)" },
  custom: { vi: "Tùy chỉnh", en: "Custom" },
};

const PRESETS: { label: Localized; expr: string }[] = [
  { label: { vi: "Mỗi phút", en: "Every minute" }, expr: "* * * * *" },
  { label: { vi: "Mỗi 15 phút", en: "Every 15 minutes" }, expr: "*/15 * * * *" },
  { label: { vi: "Mỗi giờ", en: "Every hour" }, expr: "0 * * * *" },
  { label: { vi: "Hàng ngày 00:00", en: "Daily at 00:00" }, expr: "0 0 * * *" },
  { label: { vi: "Thứ Hai 09:00", en: "Monday 09:00" }, expr: "0 9 * * 1" },
  { label: { vi: "Mùng 1 hàng tháng", en: "1st of the month" }, expr: "0 0 1 * *" },
  { label: { vi: "Cuối tuần 10:00", en: "Weekends 10:00" }, expr: "0 10 * * 6,0" },
];

const MONTH_LABELS: { value: number; vi: string; en: string }[] = [
  { value: 1, vi: "Th1", en: "Jan" },
  { value: 2, vi: "Th2", en: "Feb" },
  { value: 3, vi: "Th3", en: "Mar" },
  { value: 4, vi: "Th4", en: "Apr" },
  { value: 5, vi: "Th5", en: "May" },
  { value: 6, vi: "Th6", en: "Jun" },
  { value: 7, vi: "Th7", en: "Jul" },
  { value: 8, vi: "Th8", en: "Aug" },
  { value: 9, vi: "Th9", en: "Sep" },
  { value: 10, vi: "Th10", en: "Oct" },
  { value: 11, vi: "Th11", en: "Nov" },
  { value: 12, vi: "Th12", en: "Dec" },
];

const DOW_LABELS: { value: number; vi: string; en: string }[] = [
  { value: 1, vi: "T2", en: "Mon" },
  { value: 2, vi: "T3", en: "Tue" },
  { value: 3, vi: "T4", en: "Wed" },
  { value: 4, vi: "T5", en: "Thu" },
  { value: 5, vi: "T6", en: "Fri" },
  { value: 6, vi: "T7", en: "Sat" },
  { value: 0, vi: "CN", en: "Sun" },
];

const EXTRA_ZONES = [
  "Asia/Ho_Chi_Minh",
  "UTC",
  "Asia/Tokyo",
  "Asia/Seoul",
  "Asia/Shanghai",
  "Asia/Singapore",
  "Asia/Kolkata",
  "Asia/Dubai",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "America/New_York",
  "America/Chicago",
  "America/Los_Angeles",
  "America/Sao_Paulo",
  "Australia/Sydney",
];

const DEFAULT_EXPR = "*/15 * * * *";

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(id);
  }, [value, delayMs]);
  return debounced;
}

/** "in 12 minutes" / "sau 12 phút" via Intl.RelativeTimeFormat. */
function relativeDelta(target: Date, nowMs: number, rtf: Intl.RelativeTimeFormat): string {
  const diffSec = Math.round((target.getTime() - nowMs) / 1000);
  const abs = Math.abs(diffSec);
  if (abs < 60) return rtf.format(diffSec, "second");
  if (abs < 3_600) return rtf.format(Math.round(diffSec / 60), "minute");
  if (abs < 86_400) return rtf.format(Math.round(diffSec / 3_600), "hour");
  if (abs < 2_592_000) return rtf.format(Math.round(diffSec / 86_400), "day");
  if (abs < 31_536_000) return rtf.format(Math.round(diffSec / 2_592_000), "month");
  return rtf.format(Math.round(diffSec / 31_536_000), "year");
}

export default function CronTool() {
  const { lang, t, locale } = useI18n();

  const [expr, setExpr] = useState(DEFAULT_EXPR);
  const [withSeconds, setWithSeconds] = useState(false);
  const [builder, setBuilder] = useState<BuilderState>(
    () => builderFromTokens(splitTokens(DEFAULT_EXPR)) ?? defaultBuilderState(),
  );

  const browserZone = useMemo(() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
    } catch {
      return "UTC";
    }
  }, []);
  const zones = useMemo(
    () => [browserZone, ...EXTRA_ZONES.filter((z) => z !== browserZone)],
    [browserZone],
  );
  const [tz, setTz] = useState(browserZone);

  const debouncedExpr = useDebouncedValue(expr, 300);

  // Live clock for the relative "in 12 minutes / sau 12 phút" badges.
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  /** Central entry point: set the expression and best-effort sync the builder. */
  const applyExpression = (next: string) => {
    setExpr(next);
    const tokens = splitTokens(next);
    if (tokens.length === 6) {
      setWithSeconds(true);
      const synced = builderFromTokens(tokens.slice(1), builder);
      if (synced) setBuilder(synced);
    } else if (tokens.length === 5) {
      setWithSeconds(false);
      const synced = builderFromTokens(tokens, builder);
      if (synced) setBuilder(synced);
    }
  };

  const toggleSeconds = () => {
    const tokens = splitTokens(expr);
    if (withSeconds) {
      if (tokens.length === 6) setExpr(tokens.slice(1).join(" "));
      setWithSeconds(false);
    } else {
      if (tokens.length === 5) setExpr(["0", ...tokens].join(" "));
      setWithSeconds(true);
    }
  };

  /** Builder → expression (one-way compose on every builder change). */
  const updateField = (key: FieldKey, patch: Partial<FieldState>) => {
    const nextBuilder: BuilderState = { ...builder, [key]: { ...builder[key], ...patch } };
    setBuilder(nextBuilder);
    const tokens = splitTokens(expr);
    const secondsToken = withSeconds ? (tokens.length === 6 ? tokens[0] : "0") : null;
    setExpr(composeExpression(nextBuilder, secondsToken));
  };

  const toggleChipValue = (key: FieldKey, value: number) => {
    const current = builder[key].specific
      .split(",")
      .map((part) => Number.parseInt(part.trim(), 10))
      .filter((n) => Number.isFinite(n));
    const next = current.includes(value)
      ? current.filter((v) => v !== value)
      : [...current, value];
    updateField(key, { mode: "specific", specific: next.sort((a, b) => a - b).join(",") });
  };

  const explanation = useMemo(() => {
    const text = debouncedExpr.trim();
    if (text === "") return { kind: "empty" as const };
    try {
      return {
        kind: "ok" as const,
        text: cronstrue.toString(text, {
          locale: lang === "vi" ? "vi" : "en",
          use24HourTimeFormat: true,
        }),
      };
    } catch {
      try {
        // Fallback: English locale (vi ships with cronstrue, but stay safe).
        return { kind: "ok" as const, text: cronstrue.toString(text, { use24HourTimeFormat: true }) };
      } catch (error) {
        return { kind: "error" as const, detail: String(error).replace(/^Error:\s*/, "") };
      }
    }
  }, [debouncedExpr, lang]);

  const nextRuns = useMemo(() => {
    const text = debouncedExpr.trim();
    if (text === "") return { kind: "empty" as const };
    try {
      const interval = CronExpressionParser.parse(text, { tz });
      const dates = interval.take(10).map((d) => d.toDate());
      return { kind: "ok" as const, dates };
    } catch (error) {
      return {
        kind: "error" as const,
        detail: error instanceof Error ? error.message : String(error),
      };
    }
  }, [debouncedExpr, tz]);

  const exprInvalid = explanation.kind === "error" || nextRuns.kind === "error";
  const errorDetail =
    nextRuns.kind === "error"
      ? nextRuns.detail
      : explanation.kind === "error"
        ? explanation.detail
        : null;

  const dateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        dateStyle: "full",
        timeStyle: "medium",
        timeZone: tz,
      }),
    [locale, tz],
  );
  const relativeFormatter = useMemo(
    () => new Intl.RelativeTimeFormat(locale, { numeric: "auto" }),
    [locale],
  );

  return (
    <div className="space-y-4">
      <Card className="animate-fade-up">
        <CardHeader
          title={t(M.exprTitle)}
          subtitle={t(M.exprSubtitle)}
          actions={
            <Button
              size="sm"
              variant={withSeconds ? "primary" : "outline"}
              onClick={toggleSeconds}
              aria-pressed={withSeconds}
            >
              <AlarmClock className="h-3.5 w-3.5" />
              {t(M.withSeconds)}
            </Button>
          }
        />
        <CardBody className="space-y-4">
          <TextInput
            aria-label={t(M.exprTitle)}
            value={expr}
            onChange={(e) => applyExpression(e.target.value)}
            spellCheck={false}
            autoComplete="off"
            className={cn(
              "h-14 text-center font-mono text-xl tracking-widest",
              exprInvalid && "border-danger/70 focus:border-danger",
            )}
          />

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs uppercase tracking-wider text-muted-foreground">
              {t(M.presets)}
            </span>
            {PRESETS.map((preset) => (
              <button
                key={preset.expr}
                type="button"
                onClick={() => applyExpression(preset.expr)}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs transition-colors",
                  expr.trim() === preset.expr
                    ? "border-primary/60 bg-primary/10 text-primary"
                    : "border-border bg-card text-muted-foreground hover:border-primary/50 hover:text-foreground",
                )}
              >
                {t(preset.label)}
              </button>
            ))}
          </div>

          {explanation.kind === "ok" ? (
            <div className="flex items-start gap-3 rounded-lg bg-primary/10 px-4 py-3">
              <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden />
              <p className="text-lg font-medium text-primary">{explanation.text}</p>
            </div>
          ) : explanation.kind === "empty" ? (
            <p className="rounded-lg bg-muted px-4 py-3 text-sm text-muted-foreground">
              {t(M.emptyExpr)}
            </p>
          ) : null}

          {exprInvalid ? (
            <div className="rounded-lg bg-danger/10 px-4 py-3 text-sm text-danger">
              <p className="font-medium">{t(M.invalidExpr)}</p>
              {errorDetail ? (
                <p className="mt-0.5 font-mono text-xs opacity-80">{errorDetail}</p>
              ) : null}
            </div>
          ) : null}
        </CardBody>
      </Card>

      <Card className="animate-fade-up">
        <CardHeader
          title={
            <span className="inline-flex items-center gap-2">
              <SlidersHorizontal className="h-4 w-4 text-primary" aria-hidden />
              {t(M.builderTitle)}
            </span>
          }
          subtitle={t(M.builderSubtitle)}
        />
        <CardBody>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            {FIELD_ORDER.map((key) => (
              <BuilderColumn
                key={key}
                fieldKey={key}
                state={builder[key]}
                onChange={(patch) => updateField(key, patch)}
                onToggleChip={(value) => toggleChipValue(key, value)}
              />
            ))}
          </div>
        </CardBody>
      </Card>

      <Card className="animate-fade-up">
        <CardHeader
          title={
            <span className="inline-flex items-center gap-2">
              <CalendarClock className="h-4 w-4 text-primary" aria-hidden />
              {t(M.nextRunsTitle)}
            </span>
          }
          subtitle={t(M.nextRunsSubtitle)}
          actions={<CopyButton text={expr.trim()} label={t(M.copyExpr)} />}
        />
        <CardBody className="space-y-4">
          <Field label={t(M.timezone)} htmlFor="cron-tz" className="max-w-xs">
            <Select id="cron-tz" value={tz} onChange={(e) => setTz(e.target.value)}>
              {zones.map((zone) => (
                <option key={zone} value={zone}>
                  {zone === browserZone
                    ? `${zone.replace(/_/g, " ")} — ${t(M.browserZone)}`
                    : zone.replace(/_/g, " ")}
                </option>
              ))}
            </Select>
          </Field>

          {nextRuns.kind === "ok" && nextRuns.dates.length > 0 ? (
            <ol className="divide-y divide-border rounded-xl border border-border">
              {nextRuns.dates.map((date, index) => (
                <li
                  key={`${date.getTime()}-${index}`}
                  className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2.5"
                >
                  <span className="w-6 shrink-0 text-right font-mono text-xs text-muted-foreground">
                    {index + 1}
                  </span>
                  <span className="min-w-0 flex-1 basis-52 text-sm">
                    {dateFormatter.format(date)}
                  </span>
                  <span className="shrink-0 rounded-md bg-accent/15 px-2 py-0.5 text-xs font-medium text-accent">
                    {relativeDelta(date, nowMs, relativeFormatter)}
                  </span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="rounded-lg bg-muted px-4 py-6 text-center text-sm text-muted-foreground">
              {nextRuns.kind === "error"
                ? t(M.fixExprFirst)
                : nextRuns.kind === "empty"
                  ? t(M.emptyExpr)
                  : t(M.noRuns)}
            </p>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

function BuilderColumn({
  fieldKey,
  state,
  onChange,
  onToggleChip,
}: {
  fieldKey: FieldKey;
  state: FieldState;
  onChange: (patch: Partial<FieldState>) => void;
  onToggleChip: (value: number) => void;
}) {
  const { t } = useI18n();
  const { min, max } = FIELD_RANGE[fieldKey];
  const useChips = fieldKey === "month" || fieldKey === "dayOfWeek";
  const chipDefs = fieldKey === "month" ? MONTH_LABELS : DOW_LABELS;
  const selectedChips = state.specific
    .split(",")
    .map((part) => Number.parseInt(part.trim(), 10))
    .filter((n) => Number.isFinite(n));
  const specificInvalid =
    state.mode === "specific" && !useChips && !specificListValid(state.specific, fieldKey);

  return (
    <div className="space-y-2 rounded-xl border border-border bg-muted/40 p-3">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {t(FIELD_LABEL[fieldKey])}
        <span className="ml-1.5 font-mono normal-case text-muted-foreground/70">
          {min}–{max}
        </span>
      </p>

      <Select
        aria-label={`${t(FIELD_LABEL[fieldKey])} — ${t(MODE_LABEL[state.mode])}`}
        value={state.mode}
        onChange={(e) => onChange({ mode: e.target.value as FieldMode })}
        className="h-9 text-xs"
      >
        {(["every", "specific", "range", "step"] as const).map((mode) => (
          <option key={mode} value={mode}>
            {t(MODE_LABEL[mode])}
          </option>
        ))}
        {state.mode === "custom" ? (
          <option value="custom">{t(MODE_LABEL.custom)}</option>
        ) : null}
      </Select>

      {state.mode === "specific" && useChips ? (
        <div className="flex flex-wrap gap-1">
          {chipDefs.map((chip) => {
            const active = selectedChips.includes(chip.value);
            return (
              <button
                key={chip.value}
                type="button"
                onClick={() => onToggleChip(chip.value)}
                aria-pressed={active}
                className={cn(
                  "rounded-md border px-1.5 py-0.5 text-[11px] transition-colors",
                  active
                    ? "border-primary/60 bg-primary/10 font-medium text-primary"
                    : "border-border bg-card text-muted-foreground hover:text-foreground",
                )}
              >
                {t({ vi: chip.vi, en: chip.en })}
              </button>
            );
          })}
        </div>
      ) : null}

      {state.mode === "specific" && !useChips ? (
        <div>
          <TextInput
            aria-label={`${t(FIELD_LABEL[fieldKey])} — ${t(MODE_LABEL.specific)}`}
            value={state.specific}
            onChange={(e) => onChange({ specific: e.target.value })}
            placeholder={t(M.specificPlaceholder)}
            spellCheck={false}
            className={cn("h-9 font-mono text-xs", specificInvalid && "border-danger/70")}
          />
          {specificInvalid ? (
            <p className="mt-1 text-[11px] text-danger">{t(M.specificInvalid)}</p>
          ) : null}
        </div>
      ) : null}

      {state.mode === "range" ? (
        <div className="flex items-center gap-1.5">
          <TextInput
            aria-label={`${t(FIELD_LABEL[fieldKey])} — ${t(M.from)}`}
            type="number"
            min={min}
            max={max}
            value={state.rangeFrom}
            onChange={(e) => onChange({ rangeFrom: e.target.value })}
            placeholder={t(M.from)}
            className="h-9 font-mono text-xs"
          />
          <span className="text-xs text-muted-foreground">–</span>
          <TextInput
            aria-label={`${t(FIELD_LABEL[fieldKey])} — ${t(M.to)}`}
            type="number"
            min={min}
            max={max}
            value={state.rangeTo}
            onChange={(e) => onChange({ rangeTo: e.target.value })}
            placeholder={t(M.to)}
            className="h-9 font-mono text-xs"
          />
        </div>
      ) : null}

      {state.mode === "step" ? (
        <TextInput
          aria-label={`${t(FIELD_LABEL[fieldKey])} — ${t(M.stepEvery)}`}
          type="number"
          min={1}
          max={max}
          value={state.step}
          onChange={(e) => onChange({ step: e.target.value })}
          placeholder={t(M.stepEvery)}
          className="h-9 font-mono text-xs"
        />
      ) : null}

      {state.mode === "custom" ? (
        <div>
          <p className="rounded-md border border-dashed border-border bg-card px-2 py-1.5 font-mono text-xs">
            {state.customToken}
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">{t(M.customHint)}</p>
        </div>
      ) : null}
    </div>
  );
}
