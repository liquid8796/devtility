"use client";

import { DateTime } from "luxon";
import { Clock, Globe2, Plus, RadioTower, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { CopyButton } from "@/components/ui/copy-button";
import { Field, Select, TextInput } from "@/components/ui/field";
import { cn } from "@/lib/utils";

import { getTimeZones, zoneLabel } from "./zones";

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

export default function TimezoneTool() {
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
          title="Thời gian nguồn"
          subtitle="Chọn thời điểm và múi giờ gốc cần chuyển đổi"
          actions={
            <Button
              size="sm"
              variant={live ? "primary" : "outline"}
              onClick={toggleLive}
              aria-pressed={live}
            >
              <RadioTower className="h-3.5 w-3.5" />
              Bây giờ
            </Button>
          }
        />
        <CardBody>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Ngày giờ"
              htmlFor="tz-source-time"
              hint={live ? "Đang cập nhật theo thời gian thực — tắt “Bây giờ” để tự nhập." : undefined}
            >
              <TextInput
                id="tz-source-time"
                type="datetime-local"
                value={live ? toInputValue(source) : inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                disabled={live}
              />
            </Field>
            <Field label="Múi giờ nguồn" htmlFor="tz-source-zone">
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
                {source.setLocale("vi").toFormat("cccc, dd/MM/yyyy")}
              </span>
              <span className="rounded-md bg-primary/10 px-2 py-0.5 font-mono text-xs text-primary">
                {offsetText(source)}
              </span>
            </div>
          ) : (
            <p className="mt-4 rounded-lg bg-danger/10 px-4 py-3 text-sm text-danger">
              Ngày giờ không hợp lệ. Vui lòng kiểm tra lại giá trị đã nhập.
            </p>
          )}
        </CardBody>
      </Card>

      <Card className="animate-fade-up">
        <CardHeader
          title="Múi giờ đích"
          subtitle="Kết quả được sắp xếp theo độ lệch UTC tăng dần"
        />
        <CardBody className="space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row">
            <TextInput
              aria-label="Lọc múi giờ"
              placeholder="Lọc múi giờ… (ví dụ: Ho Chi Minh, Berlin)"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="sm:max-w-56"
            />
            <div className="flex min-w-0 flex-1 gap-2">
              <div className="min-w-0 flex-1">
                <Select
                  aria-label="Chọn múi giờ để thêm"
                  value={effectiveZoneToAdd}
                  onChange={(e) => setZoneToAdd(e.target.value)}
                  disabled={addCandidates.length === 0}
                >
                  {addCandidates.length === 0 ? (
                    <option value="">Không có múi giờ phù hợp</option>
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
                Thêm
              </Button>
            </div>
          </div>

          {rows.length === 0 ? (
            <p className="rounded-lg bg-muted px-4 py-6 text-center text-sm text-muted-foreground">
              {sourceValid
                ? "Chưa có múi giờ đích nào. Hãy thêm múi giờ ở phía trên."
                : "Nhập thời gian nguồn hợp lệ để xem kết quả chuyển đổi."}
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
                          {dayDiff > 0 ? `+${dayDiff} ngày` : `−${Math.abs(dayDiff)} ngày`}
                        </span>
                      ) : null}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {converted.setLocale("vi").toFormat("cccc, dd/MM/yyyy")}
                    </p>
                  </div>
                  <div className="ml-auto flex shrink-0 items-center gap-1.5">
                    <CopyButton text={converted.toISO() ?? ""} label="Sao chép ISO 8601" />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      aria-label={`Xóa múi giờ ${zoneLabel(zone)}`}
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
