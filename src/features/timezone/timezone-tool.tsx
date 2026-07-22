"use client";

import { DateTime } from "luxon";
import { Clock, Globe2, Plus, RadioTower, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { CopyButton } from "@/components/ui/copy-button";
import { Field, Select, TextInput } from "@/components/ui/field";
import type { Lang, Localized } from "@/lib/i18n";
import { useI18n } from "@/lib/i18n/use-lang";
import { cn } from "@/lib/utils";

import { getTimeZones, zoneLabel } from "./zones";

const M = {
  sourceTitle: { vi: "Thời gian nguồn", en: "Source time" },
  sourceSubtitle: {
    vi: "Chọn thời điểm và múi giờ gốc cần chuyển đổi",
    en: "Pick the moment and the source time zone to convert",
  },
  now: { vi: "Bây giờ", en: "Now" },
  dateTime: { vi: "Ngày giờ", en: "Date & time" },
  liveHint: {
    vi: "Đang cập nhật theo thời gian thực — tắt “Bây giờ” để tự nhập.",
    en: "Updating in real time — turn off “Now” to enter a time manually.",
  },
  sourceZone: { vi: "Múi giờ nguồn", en: "Source time zone" },
  invalidDateTime: {
    vi: "Ngày giờ không hợp lệ. Vui lòng kiểm tra lại giá trị đã nhập.",
    en: "Invalid date or time. Please check the entered value.",
  },
  targetTitle: { vi: "Múi giờ đích", en: "Target time zones" },
  targetSubtitle: {
    vi: "Kết quả được sắp xếp theo độ lệch UTC tăng dần",
    en: "Results are sorted by UTC offset, ascending",
  },
  filterZones: { vi: "Lọc múi giờ", en: "Filter time zones" },
  filterPlaceholder: {
    vi: "Lọc múi giờ… (ví dụ: Ho Chi Minh, Berlin)",
    en: "Filter time zones… (e.g. Ho Chi Minh, Berlin)",
  },
  zoneToAdd: { vi: "Chọn múi giờ để thêm", en: "Choose a time zone to add" },
  noMatchingZones: { vi: "Không có múi giờ phù hợp", en: "No matching time zones" },
  add: { vi: "Thêm", en: "Add" },
  emptyTargets: {
    vi: "Chưa có múi giờ đích nào. Hãy thêm múi giờ ở phía trên.",
    en: "No target time zones yet. Add one above.",
  },
  enterValidSource: {
    vi: "Nhập thời gian nguồn hợp lệ để xem kết quả chuyển đổi.",
    en: "Enter a valid source time to see the conversion results.",
  },
  copyIso: { vi: "Sao chép ISO 8601", en: "Copy ISO 8601" },
  removeZone: { vi: "Xóa múi giờ", en: "Remove time zone" },
} satisfies Record<string, Localized>;

const DEFAULT_TARGETS = [
  "UTC",
  "Asia/Ho_Chi_Minh",
  "Asia/Tokyo",
  "Asia/Singapore",
  "Europe/London",
  "Europe/Paris",
  "America/New_York",
  "America/Los_Angeles",
  "Australia/Sydney",
];

/** Local-date serial number (days since epoch of the wall-clock date). */
function localDayNumber(dt: DateTime): number {
  return Math.floor(DateTime.utc(dt.year, dt.month, dt.day).toMillis() / 86_400_000);
}

function offsetText(dt: DateTime): string {
  return `UTC${dt.toFormat("ZZ")}`;
}

function toInputValue(dt: DateTime): string {
  return dt.toFormat("yyyy-MM-dd'T'HH:mm");
}

/** Day-shift badge text, e.g. "+1 ngày" / "+1 day". */
function dayDiffText(dayDiff: number, lang: Lang): string {
  const abs = Math.abs(dayDiff);
  const unit = lang === "vi" ? "ngày" : abs === 1 ? "day" : "days";
  return dayDiff > 0 ? `+${dayDiff} ${unit}` : `−${abs} ${unit}`;
}

export default function TimezoneTool() {
  const { lang, t } = useI18n();
  const allZones = useMemo(() => getTimeZones(), []);
  const browserZone = useMemo(() => DateTime.local().zoneName ?? "Asia/Ho_Chi_Minh", []);

  const [sourceZone, setSourceZone] = useState(browserZone);
  const [live, setLive] = useState(true);
  const [inputValue, setInputValue] = useState(() => toInputValue(DateTime.local()));
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [targets, setTargets] = useState<string[]>(() =>
    DEFAULT_TARGETS.filter((z) => z !== browserZone),
  );
  const [filter, setFilter] = useState("");
  const [zoneToAdd, setZoneToAdd] = useState("");

  useEffect(() => {
    if (!live) return;
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, [live]);

  const source: DateTime = useMemo(() => {
    if (live) return DateTime.fromMillis(nowMs).setZone(sourceZone);
    return DateTime.fromISO(inputValue, { zone: sourceZone });
  }, [live, nowMs, inputValue, sourceZone]);

  const sourceValid = source.isValid;

  const rows = useMemo(() => {
    if (!sourceValid) return [];
    return targets
      .map((zone) => {
        const converted = source.setZone(zone);
        return { zone, converted, dayDiff: localDayNumber(converted) - localDayNumber(source) };
      })
      .filter((r) => r.converted.isValid)
      .sort((a, b) => a.converted.offset - b.converted.offset);
  }, [targets, source, sourceValid]);

  const addCandidates = useMemo(() => {
    const q = filter.trim().toLowerCase().replace(/\s+/g, "_");
    return allZones.filter(
      (z) => !targets.includes(z) && z !== sourceZone && (q === "" || z.toLowerCase().includes(q)),
    );
  }, [allZones, targets, sourceZone, filter]);

  const effectiveZoneToAdd =
    zoneToAdd && addCandidates.includes(zoneToAdd) ? zoneToAdd : addCandidates[0] ?? "";

  const addZone = () => {
    if (!effectiveZoneToAdd) return;
    setTargets((prev) => (prev.includes(effectiveZoneToAdd) ? prev : [...prev, effectiveZoneToAdd]));
    setZoneToAdd("");
    setFilter("");
  };

  const toggleLive = () => {
    if (live) {
      // Freeze the current moment into the manual input for editing.
      setInputValue(toInputValue(DateTime.fromMillis(nowMs).setZone(sourceZone)));
    } else {
      setNowMs(Date.now());
    }
    setLive((v) => !v);
  };

  return (
    <div className="space-y-4">
      <Card className="animate-fade-up">
        <CardHeader
          title={t(M.sourceTitle)}
          subtitle={t(M.sourceSubtitle)}
          actions={
            <Button
              size="sm"
              variant={live ? "primary" : "outline"}
              onClick={toggleLive}
              aria-pressed={live}
            >
              <RadioTower className="h-3.5 w-3.5" />
              {t(M.now)}
            </Button>
          }
        />
        <CardBody>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label={t(M.dateTime)}
              htmlFor="tz-source-time"
              hint={live ? t(M.liveHint) : undefined}
            >
              <TextInput
                id="tz-source-time"
                type="datetime-local"
                value={live ? toInputValue(source) : inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                disabled={live}
              />
            </Field>
            <Field label={t(M.sourceZone)} htmlFor="tz-source-zone">
              <Select
                id="tz-source-zone"
                value={sourceZone}
                onChange={(e) => setSourceZone(e.target.value)}
              >
                {allZones.map((z) => (
                  <option key={z} value={z}>
                    {zoneLabel(z)}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          {sourceValid ? (
            <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg bg-muted px-4 py-3">
              <Clock className="h-4 w-4 shrink-0 text-primary" aria-hidden />
              <span className="font-mono text-lg font-semibold tabular-nums">
                {source.toFormat("HH:mm:ss")}
              </span>
              <span className="text-sm text-muted-foreground">
                {source.setLocale(lang).toFormat("cccc, dd/MM/yyyy")}
              </span>
              <span className="rounded-md bg-primary/10 px-2 py-0.5 font-mono text-xs text-primary">
                {offsetText(source)}
              </span>
            </div>
          ) : (
            <p className="mt-4 rounded-lg bg-danger/10 px-4 py-3 text-sm text-danger">
              {t(M.invalidDateTime)}
            </p>
          )}
        </CardBody>
      </Card>

      <Card className="animate-fade-up">
        <CardHeader
          title={t(M.targetTitle)}
          subtitle={t(M.targetSubtitle)}
        />
        <CardBody className="space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row">
            <TextInput
              aria-label={t(M.filterZones)}
              placeholder={t(M.filterPlaceholder)}
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="sm:max-w-56"
            />
            <div className="flex min-w-0 flex-1 gap-2">
              <div className="min-w-0 flex-1">
                <Select
                  aria-label={t(M.zoneToAdd)}
                  value={effectiveZoneToAdd}
                  onChange={(e) => setZoneToAdd(e.target.value)}
                  disabled={addCandidates.length === 0}
                >
                  {addCandidates.length === 0 ? (
                    <option value="">{t(M.noMatchingZones)}</option>
                  ) : (
                    addCandidates.map((z) => (
                      <option key={z} value={z}>
                        {zoneLabel(z)}
                      </option>
                    ))
                  )}
                </Select>
              </div>
              <Button onClick={addZone} disabled={!effectiveZoneToAdd} className="shrink-0">
                <Plus className="h-4 w-4" />
                {t(M.add)}
              </Button>
            </div>
          </div>

          {rows.length === 0 ? (
            <p className="rounded-lg bg-muted px-4 py-6 text-center text-sm text-muted-foreground">
              {sourceValid ? t(M.emptyTargets) : t(M.enterValidSource)}
            </p>
          ) : (
            <ul className="divide-y divide-border rounded-xl border border-border">
              {rows.map(({ zone, converted, dayDiff }) => (
                <li
                  key={zone}
                  className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3"
                >
                  <div className="flex min-w-0 flex-1 basis-48 items-center gap-2">
                    <Globe2 className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{zoneLabel(zone)}</p>
                      <p className="font-mono text-xs text-muted-foreground">{offsetText(converted)}</p>
                    </div>
                  </div>
                  <div className="basis-40">
                    <p className="font-mono text-lg font-semibold tabular-nums">
                      {converted.toFormat("HH:mm:ss")}
                      {dayDiff !== 0 ? (
                        <span
                          className={cn(
                            "ml-2 align-middle rounded-md px-1.5 py-0.5 font-sans text-[11px] font-medium",
                            dayDiff > 0 ? "bg-warning/15 text-warning" : "bg-accent/15 text-accent",
                          )}
                        >
                          {dayDiffText(dayDiff, lang)}
                        </span>
                      ) : null}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {converted.setLocale(lang).toFormat("cccc, dd/MM/yyyy")}
                    </p>
                  </div>
                  <div className="ml-auto flex shrink-0 items-center gap-1.5">
                    <CopyButton text={converted.toISO() ?? ""} label={t(M.copyIso)} />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      aria-label={`${t(M.removeZone)} ${zoneLabel(zone)}`}
                      onClick={() => setTargets((prev) => prev.filter((z) => z !== zone))}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
