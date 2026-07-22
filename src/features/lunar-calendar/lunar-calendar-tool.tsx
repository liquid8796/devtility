"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Clock, Moon, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Field, Select, TextInput } from "@/components/ui/field";
import { Tabs } from "@/components/ui/tabs";
import type { Localized } from "@/lib/i18n";
import { useI18n } from "@/lib/i18n/use-lang";
import { cn } from "@/lib/utils";
import {
  convertLunar2Solar,
  convertSolar2Lunar,
  jdFromDate,
  jdToDate,
  type LunarDate,
} from "@/lib/calendar/lunar";
import {
  canChiOfDay,
  canChiOfMonth,
  canChiOfYear,
  chiIndexOfDay,
  getDayQuality,
  ngayHoangDao,
  tietKhi,
  type NgayHoangDaoResult,
} from "@/lib/calendar/canchi";

const MIN_YEAR = 1900;
const MAX_YEAR = 2199;

/** Tiêu đề cột trong lưới lịch (tuần bắt đầu Thứ Hai, cột cuối là Chủ Nhật). */
const WEEK_HEADERS: readonly Localized[] = [
  { vi: "T2", en: "Mo" },
  { vi: "T3", en: "Tu" },
  { vi: "T4", en: "We" },
  { vi: "T5", en: "Th" },
  { vi: "T6", en: "Fr" },
  { vi: "T7", en: "Sa" },
  { vi: "CN", en: "Su" },
];

/** Tên thứ đầy đủ, đánh chỉ số theo `(jd + 1) % 7` (0 = Chủ Nhật). */
const WEEKDAY_FULL = [
  { vi: "Chủ Nhật", en: "Sunday" },
  { vi: "Thứ Hai", en: "Monday" },
  { vi: "Thứ Ba", en: "Tuesday" },
  { vi: "Thứ Tư", en: "Wednesday" },
  { vi: "Thứ Năm", en: "Thursday" },
  { vi: "Thứ Sáu", en: "Friday" },
  { vi: "Thứ Bảy", en: "Saturday" },
] as const satisfies readonly Localized[];

const EN_MONTH_FORMAT = new Intl.DateTimeFormat("en-US", { month: "long" });

/** English month name ("July") for a 1-based month number. */
function monthNameEn(m: number): string {
  return EN_MONTH_FORMAT.format(new Date(2000, m - 1, 1));
}

const M = {
  prevMonth: { vi: "Tháng trước", en: "Previous month" },
  nextMonth: { vi: "Tháng sau", en: "Next month" },
  selectMonth: { vi: "Chọn tháng", en: "Select month" },
  selectYear: { vi: "Chọn năm", en: "Select year" },
  today: { vi: "Hôm nay", en: "Today" },
  legendAuspicious: { vi: "Ngày hoàng đạo", en: "Auspicious day (hoàng đạo)" },
  legendInauspicious: { vi: "Ngày hắc đạo", en: "Inauspicious day (hắc đạo)" },
  legendFirstDay: { vi: "Mồng 1 âm lịch", en: "First day of lunar month" },
  dayDetailTitle: { vi: "Chi tiết ngày", en: "Day details" },
  lunarHeading: { vi: "Âm lịch", en: "Lunar date" },
  infoDay: { vi: "Ngày", en: "Day" },
  infoMonth: { vi: "Tháng", en: "Month" },
  infoYear: { vi: "Năm", en: "Year" },
  infoTietKhi: { vi: "Tiết khí", en: "Solar term (tiết khí)" },
  auspiciousHours: { vi: "Giờ hoàng đạo", en: "Auspicious hours (giờ hoàng đạo)" },
  converterTitle: {
    vi: "Đổi ngày dương lịch – âm lịch",
    en: "Solar – lunar date converter",
  },
  tabSolarToLunar: { vi: "Dương → Âm", en: "Solar → Lunar" },
  tabLunarToSolar: { vi: "Âm → Dương", en: "Lunar → Solar" },
  converterEmpty: {
    vi: "Nhập đầy đủ ngày, tháng, năm để chuyển đổi.",
    en: "Enter the day, month, and year to convert.",
  },
  viewOnCalendar: { vi: "Xem trên lịch", en: "View on calendar" },
  fieldDay: { vi: "Ngày", en: "Day" },
  fieldMonth: { vi: "Tháng", en: "Month" },
  fieldYear: { vi: "Năm", en: "Year" },
  fieldLunarDay: { vi: "Ngày âm", en: "Lunar day" },
  fieldLunarMonth: { vi: "Tháng âm", en: "Lunar month" },
  fieldLunarYear: { vi: "Năm âm", en: "Lunar year" },
  leapMonth: { vi: "Tháng nhuận", en: "Leap month" },
  errInteger: {
    vi: "Vui lòng nhập số nguyên hợp lệ.",
    en: "Please enter valid whole numbers.",
  },
  errMonthRange: {
    vi: "Tháng phải nằm trong khoảng 1–12.",
    en: "Month must be between 1 and 12.",
  },
  errLunarDayRange: {
    vi: "Ngày âm lịch phải nằm trong khoảng 1–30.",
    en: "Lunar day must be between 1 and 30.",
  },
} satisfies Record<string, Localized>;

const YEAR_OPTIONS = Array.from({ length: MAX_YEAR - MIN_YEAR + 1 }, (_, i) => MIN_YEAR + i);

interface SimpleDate {
  d: number;
  m: number;
  y: number;
}

interface CellInfo {
  jd: number;
  d: number;
  m: number;
  y: number;
  inMonth: boolean;
  lunar: LunarDate;
  quality: NgayHoangDaoResult;
}

function daysInSolarMonth(m: number, y: number): number {
  if (m === 2) {
    const leap = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
    return leap ? 29 : 28;
  }
  return m === 4 || m === 6 || m === 9 || m === 11 ? 30 : 31;
}

/** Dựng lưới ô ngày cho tháng đang xem (tuần bắt đầu từ Thứ Hai). */
function buildMonthCells(month: number, year: number): CellInfo[] {
  const firstJd = jdFromDate(1, month, year);
  const offset = firstJd % 7; // 0 = Thứ Hai
  const total = Math.ceil((offset + daysInSolarMonth(month, year)) / 7) * 7;
  const startJd = firstJd - offset;
  const cells: CellInfo[] = [];
  for (let i = 0; i < total; i++) {
    const jd = startJd + i;
    const [d, m, y] = jdToDate(jd);
    const lunar = convertSolar2Lunar(d, m, y);
    cells.push({
      jd,
      d,
      m,
      y,
      inMonth: m === month && y === year,
      lunar,
      quality: ngayHoangDao(lunar.month, chiIndexOfDay(jd)),
    });
  }
  return cells;
}

function sameDate(a: SimpleDate, b: SimpleDate): boolean {
  return a.d === b.d && a.m === b.m && a.y === b.y;
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2">
      <dt className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</dt>
      <dd className="text-sm font-semibold">{value}</dd>
    </div>
  );
}

type ConvertResult = { text: Localized; date?: SimpleDate } | { error: Localized } | null;

export default function LunarCalendarTool() {
  const { t } = useI18n();
  const [today] = useState<SimpleDate>(() => {
    const now = new Date();
    return { d: now.getDate(), m: now.getMonth() + 1, y: now.getFullYear() };
  });
  const [view, setView] = useState<{ m: number; y: number }>({ m: today.m, y: today.y });
  const [selected, setSelected] = useState<SimpleDate>(today);

  const cells = useMemo(() => buildMonthCells(view.m, view.y), [view]);

  const detail = useMemo(() => {
    const jd = jdFromDate(selected.d, selected.m, selected.y);
    const lunar = convertSolar2Lunar(selected.d, selected.m, selected.y);
    const quality = getDayQuality(jd, lunar.month);
    return {
      jd,
      lunar,
      quality,
      weekday: WEEKDAY_FULL[(jd + 1) % 7],
      canChiDay: canChiOfDay(jd),
      canChiMonth: canChiOfMonth(lunar.month, lunar.year),
      canChiYear: canChiOfYear(lunar.year),
      tiet: tietKhi(jd),
    };
  }, [selected]);

  const goMonth = (delta: number) => {
    setView((v) => {
      let m = v.m + delta;
      let y = v.y;
      if (m < 1) {
        m = 12;
        y -= 1;
      } else if (m > 12) {
        m = 1;
        y += 1;
      }
      if (y < MIN_YEAR || y > MAX_YEAR) return v;
      return { m, y };
    });
  };

  const jumpToDate = (date: SimpleDate) => {
    setSelected(date);
    if (date.y >= MIN_YEAR && date.y <= MAX_YEAR) {
      setView({ m: date.m, y: date.y });
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        {/* ===== Lịch tháng ===== */}
        <Card>
          <CardBody className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={t(M.prevMonth)}
                  onClick={() => goMonth(-1)}
                  disabled={view.y === MIN_YEAR && view.m === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <h3 className="min-w-36 text-center text-base font-semibold tracking-wide">
                  {t({
                    vi: `Tháng ${view.m}, ${view.y}`,
                    en: `${monthNameEn(view.m)} ${view.y}`,
                  })}
                </h3>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={t(M.nextMonth)}
                  onClick={() => goMonth(1)}
                  disabled={view.y === MAX_YEAR && view.m === 12}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="w-28">
                  <Select
                    aria-label={t(M.selectMonth)}
                    className="h-9"
                    value={view.m}
                    onChange={(e) => setView((v) => ({ ...v, m: Number(e.target.value) }))}
                  >
                    {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                      <option key={m} value={m}>
                        {t({ vi: `Tháng ${m}`, en: monthNameEn(m) })}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="w-24">
                  <Select
                    aria-label={t(M.selectYear)}
                    className="h-9"
                    value={view.y}
                    onChange={(e) => setView((v) => ({ ...v, y: Number(e.target.value) }))}
                  >
                    {YEAR_OPTIONS.map((y) => (
                      <option key={y} value={y}>
                        {y}
                      </option>
                    ))}
                  </Select>
                </div>
                <Button variant="outline" size="sm" onClick={() => jumpToDate(today)}>
                  {t(M.today)}
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-7 gap-1">
              {WEEK_HEADERS.map((h, index) => (
                <div
                  key={h.vi}
                  className={cn(
                    "py-1 text-center text-xs font-semibold uppercase tracking-wider",
                    index === 6 ? "text-danger" : "text-muted-foreground",
                  )}
                >
                  {t(h)}
                </div>
              ))}
              {cells.map((cell) => {
                const isToday = sameDate(cell, today);
                const isSelected = sameDate(cell, selected);
                const isSunday = (cell.jd + 1) % 7 === 0;
                const lunarLabel =
                  cell.lunar.day === 1
                    ? `1/${cell.lunar.month}${cell.lunar.leap ? "N" : ""}`
                    : String(cell.lunar.day);
                return (
                  <button
                    key={cell.jd}
                    type="button"
                    onClick={() => jumpToDate({ d: cell.d, m: cell.m, y: cell.y })}
                    aria-label={t({
                      vi: `Ngày ${cell.d}/${cell.m}/${cell.y}, âm lịch ${cell.lunar.day}/${cell.lunar.month}${cell.lunar.leap ? " nhuận" : ""}`,
                      en: `Day ${cell.d}/${cell.m}/${cell.y}, lunar ${cell.lunar.day}/${cell.lunar.month}${cell.lunar.leap ? " (leap)" : ""}`,
                    })}
                    aria-pressed={isSelected}
                    className={cn(
                      "relative flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-lg py-1.5 transition-colors sm:min-h-16",
                      cell.inMonth ? "hover:bg-muted" : "opacity-40 hover:opacity-70",
                      isSelected && "bg-primary/10",
                      isToday && "ring-2 ring-primary",
                    )}
                  >
                    <span
                      className={cn(
                        "absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full",
                        cell.quality.isHoangDao ? "bg-success" : "bg-danger/40",
                      )}
                      aria-hidden
                    />
                    <span
                      className={cn(
                        "text-sm font-semibold sm:text-base",
                        isSunday ? "text-danger" : "text-foreground",
                        isSelected && !isSunday && "text-primary",
                      )}
                    >
                      {cell.d}
                    </span>
                    <span
                      className={cn(
                        "text-[10px] leading-tight",
                        cell.lunar.day === 1
                          ? "font-semibold text-accent"
                          : "text-muted-foreground",
                      )}
                    >
                      {lunarLabel}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border pt-3 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-success" aria-hidden />{" "}
                {t(M.legendAuspicious)}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-danger/40" aria-hidden />{" "}
                {t(M.legendInauspicious)}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="font-semibold text-accent">1/M</span> {t(M.legendFirstDay)}
              </span>
            </div>
          </CardBody>
        </Card>

        {/* ===== Chi tiết ngày ===== */}
        <Card className="h-fit">
          <CardHeader
            title={t(M.dayDetailTitle)}
            subtitle={`${selected.d}/${selected.m}/${selected.y}`}
          />
          <CardBody>
            <div className="text-center">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {t(detail.weekday)}
              </p>
              <p className="mt-1 text-6xl font-bold tracking-tight text-primary">{selected.d}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {t({
                  vi: `Tháng ${selected.m} năm ${selected.y}`,
                  en: `${monthNameEn(selected.m)} ${selected.y}`,
                })}
              </p>
            </div>

            <div className="mt-4 rounded-xl bg-primary/10 px-4 py-3 text-center">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {t(M.lunarHeading)}
              </p>
              <p className="mt-0.5 text-sm font-semibold">
                {t({
                  vi: `Ngày ${detail.lunar.day} tháng ${detail.lunar.month}${detail.lunar.leap ? " nhuận" : ""} năm ${detail.canChiYear}`,
                  en: `Day ${detail.lunar.day}, month ${detail.lunar.month}${detail.lunar.leap ? " (leap)" : ""}, year ${detail.canChiYear}`,
                })}
              </p>
            </div>

            <dl className="mt-4 space-y-2">
              <InfoRow label={t(M.infoDay)} value={detail.canChiDay} />
              <InfoRow label={t(M.infoMonth)} value={detail.canChiMonth} />
              <InfoRow label={t(M.infoYear)} value={detail.canChiYear} />
              <InfoRow label={t(M.infoTietKhi)} value={detail.tiet} />
            </dl>

            <div
              className={cn(
                "mt-4 flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium",
                detail.quality.isHoangDao
                  ? "bg-success/10 text-success"
                  : "bg-danger/10 text-danger",
              )}
            >
              {detail.quality.isHoangDao ? (
                <Sparkles className="h-4 w-4" aria-hidden />
              ) : (
                <Moon className="h-4 w-4" aria-hidden />
              )}
              {t({
                vi: detail.quality.label,
                en: detail.quality.isHoangDao
                  ? `Auspicious day (star ${detail.quality.star})`
                  : `Inauspicious day (star ${detail.quality.star})`,
              })}
            </div>

            <div className="mt-4">
              <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                <Clock className="h-3.5 w-3.5" aria-hidden /> {t(M.auspiciousHours)}
              </p>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {detail.quality.gioHoangDao.map((g) => (
                  <div
                    key={g.chi}
                    className="flex items-baseline justify-between gap-2 rounded-lg bg-muted px-3 py-2"
                  >
                    <span className="text-sm font-medium">{g.chi}</span>
                    <span className="text-xs text-muted-foreground">{g.range}</span>
                  </div>
                ))}
              </div>
            </div>
          </CardBody>
        </Card>
      </div>

      {/* ===== Đổi ngày ===== */}
      <ConverterCard onJumpToDate={jumpToDate} />
    </div>
  );
}

function ConverterCard({ onJumpToDate }: { onJumpToDate: (date: SimpleDate) => void }) {
  const { t } = useI18n();
  const [tab, setTab] = useState<"duong-am" | "am-duong">("duong-am");

  return (
    <Card>
      <CardHeader
        title={t(M.converterTitle)}
        subtitle={t({
          vi: `Phạm vi hỗ trợ: ${MIN_YEAR}–${MAX_YEAR}, múi giờ GMT+7`,
          en: `Supported range: ${MIN_YEAR}–${MAX_YEAR}, GMT+7 timezone`,
        })}
      />
      <CardBody className="space-y-4">
        <Tabs
          items={[
            { value: "duong-am", label: t(M.tabSolarToLunar) },
            { value: "am-duong", label: t(M.tabLunarToSolar) },
          ]}
          value={tab}
          onChange={setTab}
        />
        {tab === "duong-am" ? (
          <SolarToLunarForm onJumpToDate={onJumpToDate} />
        ) : (
          <LunarToSolarForm onJumpToDate={onJumpToDate} />
        )}
      </CardBody>
    </Card>
  );
}

function parseFields(
  dayStr: string,
  monthStr: string,
  yearStr: string,
): { d: number; m: number; y: number } | { error: Localized } | null {
  if (dayStr.trim() === "" || monthStr.trim() === "" || yearStr.trim() === "") return null;
  const d = Number(dayStr);
  const m = Number(monthStr);
  const y = Number(yearStr);
  if (!Number.isInteger(d) || !Number.isInteger(m) || !Number.isInteger(y)) {
    return { error: M.errInteger };
  }
  if (y < MIN_YEAR || y > MAX_YEAR) {
    return {
      error: {
        vi: `Năm phải nằm trong khoảng ${MIN_YEAR}–${MAX_YEAR}.`,
        en: `Year must be between ${MIN_YEAR} and ${MAX_YEAR}.`,
      },
    };
  }
  if (m < 1 || m > 12) {
    return { error: M.errMonthRange };
  }
  return { d, m, y };
}

function ResultBox({ result, onJumpToDate }: { result: ConvertResult; onJumpToDate: (date: SimpleDate) => void }) {
  const { t } = useI18n();
  if (result === null) {
    return <p className="text-sm text-muted-foreground">{t(M.converterEmpty)}</p>;
  }
  if ("error" in result) {
    return <p className="text-sm font-medium text-danger">{t(result.error)}</p>;
  }
  const { text, date } = result;
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-sm font-medium">{t(text)}</p>
      {date ? (
        <Button variant="outline" size="sm" onClick={() => onJumpToDate(date)}>
          {t(M.viewOnCalendar)}
        </Button>
      ) : null}
    </div>
  );
}

function SolarToLunarForm({ onJumpToDate }: { onJumpToDate: (date: SimpleDate) => void }) {
  const { t } = useI18n();
  const [dayStr, setDayStr] = useState("");
  const [monthStr, setMonthStr] = useState("");
  const [yearStr, setYearStr] = useState("");

  const result = useMemo<ConvertResult>(() => {
    const parsed = parseFields(dayStr, monthStr, yearStr);
    if (parsed === null || "error" in parsed) return parsed;
    const { d, m, y } = parsed;
    const maxDay = daysInSolarMonth(m, y);
    if (d < 1 || d > maxDay) {
      return {
        error: {
          vi: `Tháng ${m}/${y} dương lịch chỉ có ${maxDay} ngày.`,
          en: `The solar month ${m}/${y} only has ${maxDay} days.`,
        },
      };
    }
    const lunar = convertSolar2Lunar(d, m, y);
    const jd = jdFromDate(d, m, y);
    const weekday = WEEKDAY_FULL[(jd + 1) % 7];
    return {
      text: {
        vi:
          `${weekday.vi}, ${d}/${m}/${y} dương lịch là ngày ${lunar.day} tháng ${lunar.month}` +
          `${lunar.leap ? " nhuận" : ""} năm ${canChiOfYear(lunar.year)}` +
          ` (${lunar.day}/${lunar.month}${lunar.leap ? "N" : ""}/${lunar.year} âm lịch)` +
          ` — ngày ${canChiOfDay(jd)}.`,
        en:
          `${weekday.en}, ${d}/${m}/${y} solar is lunar day ${lunar.day}, month ${lunar.month}` +
          `${lunar.leap ? " (leap)" : ""}, year ${canChiOfYear(lunar.year)}` +
          ` (${lunar.day}/${lunar.month}${lunar.leap ? "N" : ""}/${lunar.year} lunar)` +
          ` — day ${canChiOfDay(jd)}.`,
      },
      date: { d, m, y },
    };
  }, [dayStr, monthStr, yearStr]);

  return (
    <div className="space-y-4">
      <div className="grid max-w-md grid-cols-3 gap-3">
        <Field label={t(M.fieldDay)} htmlFor="s2l-day">
          <TextInput
            id="s2l-day"
            type="number"
            inputMode="numeric"
            min={1}
            max={31}
            placeholder="dd"
            value={dayStr}
            onChange={(e) => setDayStr(e.target.value)}
          />
        </Field>
        <Field label={t(M.fieldMonth)} htmlFor="s2l-month">
          <TextInput
            id="s2l-month"
            type="number"
            inputMode="numeric"
            min={1}
            max={12}
            placeholder="mm"
            value={monthStr}
            onChange={(e) => setMonthStr(e.target.value)}
          />
        </Field>
        <Field label={t(M.fieldYear)} htmlFor="s2l-year">
          <TextInput
            id="s2l-year"
            type="number"
            inputMode="numeric"
            min={MIN_YEAR}
            max={MAX_YEAR}
            placeholder="yyyy"
            value={yearStr}
            onChange={(e) => setYearStr(e.target.value)}
          />
        </Field>
      </div>
      <div className="rounded-lg bg-muted px-4 py-3">
        <ResultBox result={result} onJumpToDate={onJumpToDate} />
      </div>
    </div>
  );
}

function LunarToSolarForm({ onJumpToDate }: { onJumpToDate: (date: SimpleDate) => void }) {
  const { t } = useI18n();
  const [dayStr, setDayStr] = useState("");
  const [monthStr, setMonthStr] = useState("");
  const [yearStr, setYearStr] = useState("");
  const [leap, setLeap] = useState(false);

  const result = useMemo<ConvertResult>(() => {
    const parsed = parseFields(dayStr, monthStr, yearStr);
    if (parsed === null || "error" in parsed) return parsed;
    const { d, m, y } = parsed;
    if (d < 1 || d > 30) {
      return { error: M.errLunarDayRange };
    }
    const [sd, sm, sy] = convertLunar2Solar(d, m, y, leap);
    if (sd === 0 && sm === 0 && sy === 0) {
      return {
        error: {
          vi: `Năm ${canChiOfYear(y)} (${y}) không có tháng ${m} nhuận.`,
          en: `Year ${canChiOfYear(y)} (${y}) has no leap month ${m}.`,
        },
      };
    }
    // Kiểm tra ngược để loại ngày 30 của tháng thiếu (chỉ có 29 ngày)
    const check = convertSolar2Lunar(sd, sm, sy);
    if (check.day !== d || check.month !== m || check.year !== y || check.leap !== leap) {
      return {
        error: {
          vi: `Tháng ${m}${leap ? " nhuận" : ""} năm ${y} âm lịch là tháng thiếu, chỉ có 29 ngày.`,
          en: `Lunar month ${m}${leap ? " (leap)" : ""} of year ${y} is a short month with only 29 days.`,
        },
      };
    }
    const jd = jdFromDate(sd, sm, sy);
    const weekday = WEEKDAY_FULL[(jd + 1) % 7];
    return {
      text: {
        vi:
          `Ngày ${d} tháng ${m}${leap ? " nhuận" : ""} năm ${canChiOfYear(y)} (${y}) âm lịch` +
          ` là ${weekday.vi}, ${sd}/${sm}/${sy} dương lịch — ngày ${canChiOfDay(jd)}.`,
        en:
          `Lunar day ${d}, month ${m}${leap ? " (leap)" : ""}, year ${canChiOfYear(y)} (${y})` +
          ` is ${weekday.en}, ${sd}/${sm}/${sy} solar — day ${canChiOfDay(jd)}.`,
      },
      date: { d: sd, m: sm, y: sy },
    };
  }, [dayStr, monthStr, yearStr, leap]);

  return (
    <div className="space-y-4">
      <div className="grid max-w-md grid-cols-3 gap-3">
        <Field label={t(M.fieldLunarDay)} htmlFor="l2s-day">
          <TextInput
            id="l2s-day"
            type="number"
            inputMode="numeric"
            min={1}
            max={30}
            placeholder="dd"
            value={dayStr}
            onChange={(e) => setDayStr(e.target.value)}
          />
        </Field>
        <Field label={t(M.fieldLunarMonth)} htmlFor="l2s-month">
          <TextInput
            id="l2s-month"
            type="number"
            inputMode="numeric"
            min={1}
            max={12}
            placeholder="mm"
            value={monthStr}
            onChange={(e) => setMonthStr(e.target.value)}
          />
        </Field>
        <Field label={t(M.fieldLunarYear)} htmlFor="l2s-year">
          <TextInput
            id="l2s-year"
            type="number"
            inputMode="numeric"
            min={MIN_YEAR}
            max={MAX_YEAR}
            placeholder="yyyy"
            value={yearStr}
            onChange={(e) => setYearStr(e.target.value)}
          />
        </Field>
      </div>
      <label className="flex w-fit cursor-pointer items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={leap}
          onChange={(e) => setLeap(e.target.checked)}
          className="h-4 w-4 accent-(--primary)"
        />
        {t(M.leapMonth)}
      </label>
      <div className="rounded-lg bg-muted px-4 py-3">
        <ResultBox result={result} onJumpToDate={onJumpToDate} />
      </div>
    </div>
  );
}
