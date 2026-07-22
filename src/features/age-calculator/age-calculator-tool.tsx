"use client";

import { DateTime } from "luxon";
import { Cake, CalendarDays, Gift } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Field, TextInput } from "@/components/ui/field";
import { Tabs } from "@/components/ui/tabs";
import { formatNumber } from "@/lib/utils";

type Mode = "now" | "custom";

const MODE_TABS = [
  { value: "now", label: "Hiện tại" },
  { value: "custom", label: "Ngày cụ thể" },
] as const;

const TOTAL_UNITS = [
  { key: "months", label: "Tổng số tháng" },
  { key: "weeks", label: "Tổng số tuần" },
  { key: "days", label: "Tổng số ngày" },
  { key: "hours", label: "Tổng số giờ" },
  { key: "minutes", label: "Tổng số phút" },
  { key: "seconds", label: "Tổng số giây" },
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
  const [birthDate, setBirthDate] = useState("");
  const [birthTime, setBirthTime] = useState("00:00");
  const [mode, setMode] = useState<Mode>("now");
  const [targetDate, setTargetDate] = useState(() => DateTime.local().toFormat("yyyy-MM-dd"));
  const [targetTime, setTargetTime] = useState(() => DateTime.local().toFormat("HH:mm"));
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    if (mode !== "now") return;
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, [mode]);

  const result = useMemo(() => {
    if (birthDate.trim() === "") return { state: "empty" } as const;

    const birth = DateTime.fromISO(`${birthDate}T${birthTime.trim() === "" ? "00:00" : birthTime}`);
    if (!birth.isValid) {
      return { state: "error", message: "Ngày sinh không hợp lệ. Vui lòng kiểm tra lại." } as const;
    }

    let target: DateTime;
    if (mode === "now") {
      target = DateTime.fromMillis(nowMs);
    } else {
      if (targetDate.trim() === "") {
        return { state: "error", message: "Vui lòng chọn ngày cần tính đến." } as const;
      }
      target = DateTime.fromISO(`${targetDate}T${targetTime.trim() === "" ? "00:00" : targetTime}`);
      if (!target.isValid) {
        return { state: "error", message: "Thời điểm tính đến không hợp lệ. Vui lòng kiểm tra lại." } as const;
      }
    }

    if (birth > target) {
      return {
        state: "error",
        message: "Ngày sinh phải trước thời điểm tính đến. Vui lòng chọn lại.",
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
        <CardHeader title="Thông tin" subtitle="Nhập ngày sinh và chọn mốc thời gian cần tính" />
        <CardBody className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Ngày sinh" htmlFor="age-birth-date">
              <TextInput
                id="age-birth-date"
                type="date"
                value={birthDate}
                max={mode === "custom" ? targetDate || undefined : DateTime.local().toFormat("yyyy-MM-dd")}
                onChange={(e) => setBirthDate(e.target.value)}
              />
            </Field>
            <Field label="Giờ sinh" htmlFor="age-birth-time" hint="Không bắt buộc — mặc định 00:00.">
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
              Tính đến
            </p>
            <Tabs items={MODE_TABS} value={mode} onChange={setMode} size="sm" />
          </div>

          {mode === "custom" ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Ngày tính đến" htmlFor="age-target-date">
                <TextInput
                  id="age-target-date"
                  type="date"
                  value={targetDate}
                  onChange={(e) => setTargetDate(e.target.value)}
                />
              </Field>
              <Field label="Giờ tính đến" htmlFor="age-target-time">
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
              Kết quả đang được cập nhật theo thời gian thực mỗi giây.
            </p>
          )}
        </CardBody>
      </Card>

      {result.state === "empty" ? (
        <Card className="animate-fade-up">
          <CardBody className="py-10 text-center text-sm text-muted-foreground">
            Nhập ngày sinh để bắt đầu tính tuổi.
          </CardBody>
        </Card>
      ) : result.state === "error" ? (
        <Card className="animate-fade-up">
          <CardBody>
            <p className="rounded-lg bg-danger/10 px-4 py-3 text-sm text-danger">{result.message}</p>
          </CardBody>
        </Card>
      ) : (
        <>
          <Card className="animate-fade-up">
            <CardHeader title="Tuổi chính xác" subtitle="Tính theo lịch, đã xử lý năm nhuận" />
            <CardBody>
              <p className="font-mono text-3xl font-bold tabular-nums text-primary sm:text-4xl">
                {Math.floor(result.parts.years)} năm {Math.floor(result.parts.months)} tháng{" "}
                {Math.floor(result.parts.days)} ngày
              </p>
              <p className="mt-1 font-mono text-lg tabular-nums text-muted-foreground">
                {Math.floor(result.parts.hours)} giờ {Math.floor(result.parts.minutes)} phút{" "}
                {Math.floor(result.parts.seconds)} giây
              </p>
              <p className="mt-4 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                <Cake className="h-4 w-4 shrink-0 text-accent" aria-hidden />
                <span>
                  Bạn sinh vào{" "}
                  <span className="font-medium text-foreground">
                    {result.birth.setLocale("vi").toFormat("cccc, dd/MM/yyyy 'lúc' HH:mm")}
                  </span>
                </span>
              </p>
            </CardBody>
          </Card>

          <Card className="animate-fade-up">
            <CardHeader title="Tổng quy đổi" subtitle="Tuổi của bạn quy đổi sang từng đơn vị" />
            <CardBody>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {TOTAL_UNITS.map(({ key, label }) => (
                  <div key={key} className="rounded-xl bg-muted px-4 py-3">
                    <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      {label}
                    </p>
                    <p className="mt-1 break-all font-mono text-lg font-semibold tabular-nums">
                      {formatNumber(result.totals[key])}
                    </p>
                  </div>
                ))}
              </div>
            </CardBody>
          </Card>

          <Card className="animate-fade-up">
            <CardHeader title="Sinh nhật tiếp theo" />
            <CardBody>
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                  <Gift className="h-6 w-6 text-primary" aria-hidden />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium">
                    {result.birthday.date.setLocale("vi").toFormat("cccc, 'ngày' dd/MM/yyyy")}
                  </p>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {result.daysUntilBirthday === 0 ? (
                      <span className="font-medium text-success">Hôm nay chính là sinh nhật của bạn! 🎉</span>
                    ) : (
                      <>
                        Còn{" "}
                        <span className="font-mono font-semibold text-foreground">
                          {formatNumber(result.daysUntilBirthday)}
                        </span>{" "}
                        ngày nữa — bạn sẽ tròn {formatNumber(result.turningAge)} tuổi.
                      </>
                    )}
                  </p>
                  {result.birthday.adjusted ? (
                    <p className="mt-1 flex items-start gap-1.5 text-xs text-warning">
                      <CalendarDays className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                      Bạn sinh ngày 29/02 — năm {result.birthday.date.year} không nhuận nên sinh nhật
                      được tính vào ngày 01/03.
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
