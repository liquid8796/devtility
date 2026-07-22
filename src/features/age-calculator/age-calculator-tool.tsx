"use client";

import { DateTime } from "luxon";
import { Cake, CalendarDays, Gift } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Field, TextInput } from "@/components/ui/field";
import { Tabs } from "@/components/ui/tabs";
import type { Lang, Localized } from "@/lib/i18n";
import { useI18n } from "@/lib/i18n/use-lang";
import { formatNumber } from "@/lib/utils";

type Mode = "now" | "custom";

const M = {
  infoTitle: { vi: "Thông tin", en: "Details" },
  infoSubtitle: {
    vi: "Nhập ngày sinh và chọn mốc thời gian cần tính",
    en: "Enter your birth date and choose the point in time to calculate to",
  },
  birthDate: { vi: "Ngày sinh", en: "Birth date" },
  birthTime: { vi: "Giờ sinh", en: "Birth time" },
  birthTimeHint: { vi: "Không bắt buộc — mặc định 00:00.", en: "Optional — defaults to 00:00." },
  calcTo: { vi: "Tính đến", en: "Calculate to" },
  targetDate: { vi: "Ngày tính đến", en: "Target date" },
  targetTime: { vi: "Giờ tính đến", en: "Target time" },
  liveNote: {
    vi: "Kết quả đang được cập nhật theo thời gian thực mỗi giây.",
    en: "The result updates in real time every second.",
  },
  emptyPrompt: {
    vi: "Nhập ngày sinh để bắt đầu tính tuổi.",
    en: "Enter your birth date to start calculating your age.",
  },
  exactAgeTitle: { vi: "Tuổi chính xác", en: "Exact age" },
  exactAgeSubtitle: {
    vi: "Tính theo lịch, đã xử lý năm nhuận",
    en: "Calendar-based, leap years accounted for",
  },
  bornPrefix: { vi: "Bạn sinh vào", en: "You were born on" },
  bornFormat: { vi: "cccc, dd/MM/yyyy 'lúc' HH:mm", en: "cccc, dd/MM/yyyy 'at' HH:mm" },
  totalsTitle: { vi: "Tổng quy đổi", en: "Age in other units" },
  totalsSubtitle: {
    vi: "Tuổi của bạn quy đổi sang từng đơn vị",
    en: "Your age converted into each unit",
  },
  nextBirthdayTitle: { vi: "Sinh nhật tiếp theo", en: "Next birthday" },
  birthdayFormat: { vi: "cccc, 'ngày' dd/MM/yyyy", en: "cccc, dd/MM/yyyy" },
  todayBirthday: {
    vi: "Hôm nay chính là sinh nhật của bạn! 🎉",
    en: "Today is your birthday! 🎉",
  },
  countdownPrefix: { vi: "Còn", en: "Only" },
  feb29Prefix: { vi: "Bạn sinh ngày 29/02 — năm ", en: "You were born on 29/02 — " },
  feb29Suffix: {
    vi: " không nhuận nên sinh nhật được tính vào ngày 01/03.",
    en: " is not a leap year, so your birthday is observed on 01/03.",
  },
  errorInvalidBirth: {
    vi: "Ngày sinh không hợp lệ. Vui lòng kiểm tra lại.",
    en: "Invalid birth date. Please check again.",
  },
  errorChooseTarget: {
    vi: "Vui lòng chọn ngày cần tính đến.",
    en: "Please choose the date to calculate to.",
  },
  errorInvalidTarget: {
    vi: "Thời điểm tính đến không hợp lệ. Vui lòng kiểm tra lại.",
    en: "Invalid target date or time. Please check again.",
  },
  errorBirthAfterTarget: {
    vi: "Ngày sinh phải trước thời điểm tính đến. Vui lòng chọn lại.",
    en: "The birth date must be before the target date. Please choose again.",
  },
} satisfies Record<string, Localized>;

const AGE_UNITS = {
  year: { vi: "năm", en: "year" },
  month: { vi: "tháng", en: "month" },
  day: { vi: "ngày", en: "day" },
  hour: { vi: "giờ", en: "hour" },
  minute: { vi: "phút", en: "minute" },
  second: { vi: "giây", en: "second" },
} satisfies Record<string, Localized>;

/** Unit word after a number: Vietnamese has no plural, English appends "s". */
function unitWord(n: number, unit: Localized, lang: Lang): string {
  if (lang === "vi") return unit.vi;
  return n === 1 ? unit.en : `${unit.en}s`;
}

/** Text after the highlighted day count: "ngày nữa — bạn sẽ tròn 30 tuổi." / "days to go — you will turn 30." */
function countdownSuffix(days: number, formattedAge: string, lang: Lang): string {
  if (lang === "vi") return `ngày nữa — bạn sẽ tròn ${formattedAge} tuổi.`;
  return `${days === 1 ? "day" : "days"} to go — you will turn ${formattedAge}.`;
}

const MODE_TABS = [
  { value: "now", label: { vi: "Hiện tại", en: "Now" } },
  { value: "custom", label: { vi: "Ngày cụ thể", en: "Specific date" } },
] as const;

const TOTAL_UNITS = [
  { key: "months", label: { vi: "Tổng số tháng", en: "Total months" } },
  { key: "weeks", label: { vi: "Tổng số tuần", en: "Total weeks" } },
  { key: "days", label: { vi: "Tổng số ngày", en: "Total days" } },
  { key: "hours", label: { vi: "Tổng số giờ", en: "Total hours" } },
  { key: "minutes", label: { vi: "Tổng số phút", en: "Total minutes" } },
  { key: "seconds", label: { vi: "Tổng số giây", en: "Total seconds" } },
] as const;

/**
 * Next occurrence of the birthday on or after `from`.
 * A Feb 29 birthday is celebrated on Mar 1 in non-leap years (adjusted = true).
 */
function nextBirthday(birth: DateTime, from: DateTime): { date: DateTime; adjusted: boolean } {
  const fromDay = from.startOf("day");
  const isFeb29 = birth.month === 2 && birth.day === 29;
  for (let y = from.year; y <= from.year + 4; y++) {
    const exact = DateTime.local(y, birth.month, birth.day);
    const adjusted = isFeb29 && !exact.isValid;
    const candidate = adjusted ? DateTime.local(y, 3, 1) : exact;
    if (candidate.isValid && candidate.startOf("day") >= fromDay) {
      return { date: candidate, adjusted };
    }
  }
  // Unreachable in practice; keeps the return type total.
  return { date: fromDay, adjusted: false };
}

export default function AgeCalculatorTool() {
  const { lang, t, locale } = useI18n();
  const [birthDate, setBirthDate] = useState("");
  const [birthTime, setBirthTime] = useState("00:00");
  const [mode, setMode] = useState<Mode>("now");
  const [targetDate, setTargetDate] = useState(() => DateTime.local().toFormat("yyyy-MM-dd"));
  const [targetTime, setTargetTime] = useState(() => DateTime.local().toFormat("HH:mm"));
  const [nowMs, setNowMs] = useState(() => Date.now());

  const modeTabs = MODE_TABS.map((item) => ({ value: item.value, label: t(item.label) }));

  useEffect(() => {
    if (mode !== "now") return;
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, [mode]);

  const result = useMemo(() => {
    if (birthDate.trim() === "") return { state: "empty" } as const;

    const birth = DateTime.fromISO(`${birthDate}T${birthTime.trim() === "" ? "00:00" : birthTime}`);
    if (!birth.isValid) {
      return { state: "error", message: M.errorInvalidBirth } as const;
    }

    let target: DateTime;
    if (mode === "now") {
      target = DateTime.fromMillis(nowMs);
    } else {
      if (targetDate.trim() === "") {
        return { state: "error", message: M.errorChooseTarget } as const;
      }
      target = DateTime.fromISO(`${targetDate}T${targetTime.trim() === "" ? "00:00" : targetTime}`);
      if (!target.isValid) {
        return { state: "error", message: M.errorInvalidTarget } as const;
      }
    }

    if (birth > target) {
      return {
        state: "error",
        message: M.errorBirthAfterTarget,
      } as const;
    }

    const parts = target.diff(birth, ["years", "months", "days", "hours", "minutes", "seconds"]);
    const totals = {
      months: Math.floor(target.diff(birth, "months").months),
      weeks: Math.floor(target.diff(birth, "weeks").weeks),
      days: Math.floor(target.diff(birth, "days").days),
      hours: Math.floor(target.diff(birth, "hours").hours),
      minutes: Math.floor(target.diff(birth, "minutes").minutes),
      seconds: Math.floor(target.diff(birth, "seconds").seconds),
    };
    const birthday = nextBirthday(birth, target);
    const daysUntilBirthday = Math.round(
      birthday.date.startOf("day").diff(target.startOf("day"), "days").days,
    );
    const turningAge = birthday.date.year - birth.year;

    return { state: "ok", birth, target, parts, totals, birthday, daysUntilBirthday, turningAge } as const;
  }, [birthDate, birthTime, mode, targetDate, targetTime, nowMs]);

  return (
    <div className="space-y-4">
      <Card className="animate-fade-up">
        <CardHeader title={t(M.infoTitle)} subtitle={t(M.infoSubtitle)} />
        <CardBody className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t(M.birthDate)} htmlFor="age-birth-date">
              <TextInput
                id="age-birth-date"
                type="date"
                value={birthDate}
                max={mode === "custom" ? targetDate || undefined : DateTime.local().toFormat("yyyy-MM-dd")}
                onChange={(e) => setBirthDate(e.target.value)}
              />
            </Field>
            <Field label={t(M.birthTime)} htmlFor="age-birth-time" hint={t(M.birthTimeHint)}>
              <TextInput
                id="age-birth-time"
                type="time"
                value={birthTime}
                onChange={(e) => setBirthTime(e.target.value)}
              />
            </Field>
          </div>

          <div>
            <p className="mb-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {t(M.calcTo)}
            </p>
            <Tabs items={modeTabs} value={mode} onChange={setMode} size="sm" />
          </div>

          {mode === "custom" ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t(M.targetDate)} htmlFor="age-target-date">
                <TextInput
                  id="age-target-date"
                  type="date"
                  value={targetDate}
                  onChange={(e) => setTargetDate(e.target.value)}
                />
              </Field>
              <Field label={t(M.targetTime)} htmlFor="age-target-time">
                <TextInput
                  id="age-target-time"
                  type="time"
                  value={targetTime}
                  onChange={(e) => setTargetTime(e.target.value)}
                />
              </Field>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              {t(M.liveNote)}
            </p>
          )}
        </CardBody>
      </Card>

      {result.state === "empty" ? (
        <Card className="animate-fade-up">
          <CardBody className="py-10 text-center text-sm text-muted-foreground">
            {t(M.emptyPrompt)}
          </CardBody>
        </Card>
      ) : result.state === "error" ? (
        <Card className="animate-fade-up">
          <CardBody>
            <p className="rounded-lg bg-danger/10 px-4 py-3 text-sm text-danger">{t(result.message)}</p>
          </CardBody>
        </Card>
      ) : (
        <>
          <Card className="animate-fade-up">
            <CardHeader title={t(M.exactAgeTitle)} subtitle={t(M.exactAgeSubtitle)} />
            <CardBody>
              <p className="font-mono text-3xl font-bold tabular-nums text-primary sm:text-4xl">
                {Math.floor(result.parts.years)} {unitWord(Math.floor(result.parts.years), AGE_UNITS.year, lang)}{" "}
                {Math.floor(result.parts.months)} {unitWord(Math.floor(result.parts.months), AGE_UNITS.month, lang)}{" "}
                {Math.floor(result.parts.days)} {unitWord(Math.floor(result.parts.days), AGE_UNITS.day, lang)}
              </p>
              <p className="mt-1 font-mono text-lg tabular-nums text-muted-foreground">
                {Math.floor(result.parts.hours)} {unitWord(Math.floor(result.parts.hours), AGE_UNITS.hour, lang)}{" "}
                {Math.floor(result.parts.minutes)} {unitWord(Math.floor(result.parts.minutes), AGE_UNITS.minute, lang)}{" "}
                {Math.floor(result.parts.seconds)} {unitWord(Math.floor(result.parts.seconds), AGE_UNITS.second, lang)}
              </p>
              <p className="mt-4 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                <Cake className="h-4 w-4 shrink-0 text-accent" aria-hidden />
                <span>
                  {t(M.bornPrefix)}{" "}
                  <span className="font-medium text-foreground">
                    {result.birth.setLocale(lang).toFormat(t(M.bornFormat))}
                  </span>
                </span>
              </p>
            </CardBody>
          </Card>

          <Card className="animate-fade-up">
            <CardHeader title={t(M.totalsTitle)} subtitle={t(M.totalsSubtitle)} />
            <CardBody>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {TOTAL_UNITS.map(({ key, label }) => (
                  <div key={key} className="rounded-xl bg-muted px-4 py-3">
                    <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      {t(label)}
                    </p>
                    <p className="mt-1 break-all font-mono text-lg font-semibold tabular-nums">
                      {formatNumber(result.totals[key], undefined, locale)}
                    </p>
                  </div>
                ))}
              </div>
            </CardBody>
          </Card>

          <Card className="animate-fade-up">
            <CardHeader title={t(M.nextBirthdayTitle)} />
            <CardBody>
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                  <Gift className="h-6 w-6 text-primary" aria-hidden />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium">
                    {result.birthday.date.setLocale(lang).toFormat(t(M.birthdayFormat))}
                  </p>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {result.daysUntilBirthday === 0 ? (
                      <span className="font-medium text-success">{t(M.todayBirthday)}</span>
                    ) : (
                      <>
                        {t(M.countdownPrefix)}{" "}
                        <span className="font-mono font-semibold text-foreground">
                          {formatNumber(result.daysUntilBirthday, undefined, locale)}
                        </span>{" "}
                        {countdownSuffix(
                          result.daysUntilBirthday,
                          formatNumber(result.turningAge, undefined, locale),
                          lang,
                        )}
                      </>
                    )}
                  </p>
                  {result.birthday.adjusted ? (
                    <p className="mt-1 flex items-start gap-1.5 text-xs text-warning">
                      <CalendarDays className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                      {t(M.feb29Prefix)}
                      {result.birthday.date.year}
                      {t(M.feb29Suffix)}
                    </p>
                  ) : null}
                </div>
              </div>
            </CardBody>
          </Card>
        </>
      )}
    </div>
  );
}
