"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Clock, Moon, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Field, Select, TextInput } from "@/components/ui/field";
import { Tabs } from "@/components/ui/tabs";
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

const WEEK_HEADERS = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"] as const;

/** Tên thứ đầy đủ, đánh chỉ số theo `(jd + 1) % 7` (0 = Chủ Nhật). */
const WEEKDAY_FULL = [
  "Chủ Nhật",
  "Thứ Hai",
  "Thứ Ba",
  "Thứ Tư",
  "Thứ Năm",
  "Thứ Sáu",
  "Thứ Bảy",
] as const;

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

type ConvertResult = { text: string; date?: SimpleDate } | { error: string } | null;

export default function LunarCalendarTool() {
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
                  aria-label="Tháng trước"
                  onClick={() => goMonth(-1)}
                  disabled={view.y === MIN_YEAR && view.m === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <h3 className="min-w-36 text-center text-base font-semibold tracking-wide">
                  Tháng {view.m}, {view.y}
                </h3>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Tháng sau"
                  onClick={() => goMonth(1)}
                  disabled={view.y === MAX_YEAR && view.m === 12}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="w-28">
                  <Select
                    aria-label="Chọn tháng"
                    className="h-9"
                    value={view.m}
                    onChange={(e) => setView((v) => ({ ...v, m: Number(e.target.value) }))}
                  >
                    {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                      <option key={m} value={m}>
                        Tháng {m}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="w-24">
                  <Select
                    aria-label="Chọn năm"
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
                  Hôm nay
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-7 gap-1">
              {WEEK_HEADERS.map((h) => (
                <div
                  key={h}
                  className={cn(
                    "py-1 text-center text-xs font-semibold uppercase tracking-wider",
                    h === "CN" ? "text-danger" : "text-muted-foreground",
                  )}
                >
                  {h}
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
                    aria-label={`Ngày ${cell.d}/${cell.m}/${cell.y}, âm lịch ${cell.lunar.day}/${cell.lunar.month}${cell.lunar.leap ? " nhuận" : ""}`}
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
                <span className="h-1.5 w-1.5 rounded-full bg-success" aria-hidden /> Ngày hoàng đạo
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-danger/40" aria-hidden /> Ngày hắc đạo
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="font-semibold text-accent">1/M</span> Mồng 1 âm lịch
              </span>
            </div>
          </CardBody>
        </Card>

        {/* ===== Chi tiết ngày ===== */}
        <Card className="h-fit">
          <CardHeader
            title="Chi tiết ngày"
            subtitle={`${selected.d}/${selected.m}/${selected.y}`}
          />
          <CardBody>
            <div className="text-center">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {detail.weekday}
              </p>
              <p className="mt-1 text-6xl font-bold tracking-tight text-primary">{selected.d}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Tháng {selected.m} năm {selected.y}
              </p>
            </div>

            <div className="mt-4 rounded-xl bg-primary/10 px-4 py-3 text-center">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Âm lịch
              </p>
              <p className="mt-0.5 text-sm font-semibold">
                Ngày {detail.lunar.day} tháng {detail.lunar.month}
                {detail.lunar.leap ? " nhuận" : ""} năm {detail.canChiYear}
              </p>
            </div>

            <dl className="mt-4 space-y-2">
              <InfoRow label="Ngày" value={detail.canChiDay} />
              <InfoRow label="Tháng" value={detail.canChiMonth} />
              <InfoRow label="Năm" value={detail.canChiYear} />
              <InfoRow label="Tiết khí" value={detail.tiet} />
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
              {detail.quality.label}
            </div>

            <div className="mt-4">
              <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                <Clock className="h-3.5 w-3.5" aria-hidden /> Giờ hoàng đạo
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
  const [tab, setTab] = useState<"duong-am" | "am-duong">("duong-am");

  return (
    <Card>
      <CardHeader
        title="Đổi ngày dương lịch – âm lịch"
        subtitle={`Phạm vi hỗ trợ: ${MIN_YEAR}–${MAX_YEAR}, múi giờ GMT+7`}
      />
      <CardBody className="space-y-4">
        <Tabs
          items={[
            { value: "duong-am", label: "Dương → Âm" },
            { value: "am-duong", label: "Âm → Dương" },
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
): { d: number; m: number; y: number } | { error: string } | null {
  if (dayStr.trim() === "" || monthStr.trim() === "" || yearStr.trim() === "") return null;
  const d = Number(dayStr);
  const m = Number(monthStr);
  const y = Number(yearStr);
  if (!Number.isInteger(d) || !Number.isInteger(m) || !Number.isInteger(y)) {
    return { error: "Vui lòng nhập số nguyên hợp lệ." };
  }
  if (y < MIN_YEAR || y > MAX_YEAR) {
    return { error: `Năm phải nằm trong khoảng ${MIN_YEAR}–${MAX_YEAR}.` };
  }
  if (m < 1 || m > 12) {
    return { error: "Tháng phải nằm trong khoảng 1–12." };
  }
  return { d, m, y };
}

function ResultBox({ result, onJumpToDate }: { result: ConvertResult; onJumpToDate: (date: SimpleDate) => void }) {
  if (result === null) {
    return (
      <p className="text-sm text-muted-foreground">Nhập đầy đủ ngày, tháng, năm để chuyển đổi.</p>
    );
  }
  if ("error" in result) {
    return <p className="text-sm font-medium text-danger">{result.error}</p>;
  }
  const { text, date } = result;
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-sm font-medium">{text}</p>
      {date ? (
        <Button variant="outline" size="sm" onClick={() => onJumpToDate(date)}>
          Xem trên lịch
        </Button>
      ) : null}
    </div>
  );
}

function SolarToLunarForm({ onJumpToDate }: { onJumpToDate: (date: SimpleDate) => void }) {
  const [dayStr, setDayStr] = useState("");
  const [monthStr, setMonthStr] = useState("");
  const [yearStr, setYearStr] = useState("");

  const result = useMemo<ConvertResult>(() => {
    const parsed = parseFields(dayStr, monthStr, yearStr);
    if (parsed === null || "error" in parsed) return parsed;
    const { d, m, y } = parsed;
    const maxDay = daysInSolarMonth(m, y);
    if (d < 1 || d > maxDay) {
      return { error: `Tháng ${m}/${y} dương lịch chỉ có ${maxDay} ngày.` };
    }
    const lunar = convertSolar2Lunar(d, m, y);
    const jd = jdFromDate(d, m, y);
    const weekday = WEEKDAY_FULL[(jd + 1) % 7];
    return {
      text:
        `${weekday}, ${d}/${m}/${y} dương lịch là ngày ${lunar.day} tháng ${lunar.month}` +
        `${lunar.leap ? " nhuận" : ""} năm ${canChiOfYear(lunar.year)}` +
        ` (${lunar.day}/${lunar.month}${lunar.leap ? "N" : ""}/${lunar.year} âm lịch)` +
        ` — ngày ${canChiOfDay(jd)}.`,
      date: { d, m, y },
    };
  }, [dayStr, monthStr, yearStr]);

  return (
    <div className="space-y-4">
      <div className="grid max-w-md grid-cols-3 gap-3">
        <Field label="Ngày" htmlFor="s2l-day">
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
        <Field label="Tháng" htmlFor="s2l-month">
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
        <Field label="Năm" htmlFor="s2l-year">
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
  const [dayStr, setDayStr] = useState("");
  const [monthStr, setMonthStr] = useState("");
  const [yearStr, setYearStr] = useState("");
  const [leap, setLeap] = useState(false);

  const result = useMemo<ConvertResult>(() => {
    const parsed = parseFields(dayStr, monthStr, yearStr);
    if (parsed === null || "error" in parsed) return parsed;
    const { d, m, y } = parsed;
    if (d < 1 || d > 30) {
      return { error: "Ngày âm lịch phải nằm trong khoảng 1–30." };
    }
    const [sd, sm, sy] = convertLunar2Solar(d, m, y, leap);
    if (sd === 0 && sm === 0 && sy === 0) {
      return { error: `Năm ${canChiOfYear(y)} (${y}) không có tháng ${m} nhuận.` };
    }
    // Kiểm tra ngược để loại ngày 30 của tháng thiếu (chỉ có 29 ngày)
    const check = convertSolar2Lunar(sd, sm, sy);
    if (check.day !== d || check.month !== m || check.year !== y || check.leap !== leap) {
      return {
        error: `Tháng ${m}${leap ? " nhuận" : ""} năm ${y} âm lịch là tháng thiếu, chỉ có 29 ngày.`,
      };
    }
    const jd = jdFromDate(sd, sm, sy);
    const weekday = WEEKDAY_FULL[(jd + 1) % 7];
    return {
      text:
        `Ngày ${d} tháng ${m}${leap ? " nhuận" : ""} năm ${canChiOfYear(y)} (${y}) âm lịch` +
        ` là ${weekday}, ${sd}/${sm}/${sy} dương lịch — ngày ${canChiOfDay(jd)}.`,
      date: { d: sd, m: sm, y: sy },
    };
  }, [dayStr, monthStr, yearStr, leap]);

  return (
    <div className="space-y-4">
      <div className="grid max-w-md grid-cols-3 gap-3">
        <Field label="Ngày âm" htmlFor="l2s-day">
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
        <Field label="Tháng âm" htmlFor="l2s-month">
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
        <Field label="Năm âm" htmlFor="l2s-year">
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
        Tháng nhuận
      </label>
      <div className="rounded-lg bg-muted px-4 py-3">
        <ResultBox result={result} onJumpToDate={onJumpToDate} />
      </div>
    </div>
  );
}
