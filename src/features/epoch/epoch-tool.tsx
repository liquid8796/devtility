"use client";

import { DateTime } from "luxon";
import { ArrowDownUp, Timer } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { CopyButton } from "@/components/ui/copy-button";
import { Field, Select, TextInput } from "@/components/ui/field";
import { Tabs } from "@/components/ui/tabs";
import { getTimeZones, zoneLabel } from "@/features/timezone/zones";

type Unit = "auto" | "s" | "ms";

const UNIT_TABS = [
  { value: "auto", label: "Tự động" },
  { value: "s", label: "Giây" },
  { value: "ms", label: "Mili giây" },
] as const;

interface Detection {
  ms: number;
  unitLabel: string;
}

/** Interpret a numeric epoch value according to the selected unit. */
function interpret(value: number, unit: Unit): Detection {
  if (unit === "s") return { ms: value * 1000, unitLabel: "giây (s)" };
  if (unit === "ms") return { ms: value, unitLabel: "mili giây (ms)" };
  const abs = Math.abs(value);
  if (abs < 1e11) return { ms: value * 1000, unitLabel: "giây (s)" };
  if (abs < 1e14) return { ms: value, unitLabel: "mili giây (ms)" };
  return { ms: value / 1000, unitLabel: "micro giây (µs)" };
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
  const allZones = useMemo(() => getTimeZones(), []);
  const browserZone = useMemo(() => DateTime.local().zoneName ?? "Asia/Ho_Chi_Minh", []);

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

  const epochResult = useMemo(() => {
    const raw = epochInput.trim().replace(/[\s_]/g, "");
    if (raw === "") return null;
    if (!/^-?\d+(\.\d+)?$/.test(raw)) {
      return { error: "Giá trị không hợp lệ. Vui lòng chỉ nhập chữ số (ví dụ: 1700000000)." } as const;
    }
    const value = Number(raw);
    if (!Number.isFinite(value)) {
      return { error: "Giá trị quá lớn, không thể xử lý." } as const;
    }
    const { ms, unitLabel } = interpret(value, unit);
    const dt = DateTime.fromMillis(ms);
    if (!dt.isValid) {
      return { error: "Giá trị nằm ngoài phạm vi ngày giờ hỗ trợ (khoảng ±270.000 năm)." } as const;
    }
    return { dt, unitLabel } as const;
  }, [epochInput, unit]);

  // ---- Date → epoch -------------------------------------------------------
  const [dateInput, setDateInput] = useState(() => toInputValue(DateTime.local()));
  const [dateZone, setDateZone] = useState(browserZone);

  const dateResult = useMemo(() => {
    if (dateInput.trim() === "") return null;
    const dt = DateTime.fromISO(dateInput, { zone: dateZone });
    if (!dt.isValid) {
      return { error: "Ngày giờ không hợp lệ. Vui lòng kiểm tra lại giá trị đã nhập." } as const;
    }
    return { dt } as const;
  }, [dateInput, dateZone]);

  return (
    <div className="space-y-4">
      <Card className="animate-fade-up">
        <CardHeader
          title="Epoch hiện tại"
          subtitle="Cập nhật theo thời gian thực mỗi giây"
        />
        <CardBody>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl bg-muted px-4 py-3">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Giây (s)</p>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <span className="break-all font-mono text-2xl font-semibold tabular-nums text-primary">
                  {nowSec}
                </span>
                <CopyButton text={String(nowSec)} />
              </div>
            </div>
            <div className="rounded-xl bg-muted px-4 py-3">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Mili giây (ms)</p>
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
            {now.setLocale("vi").toFormat("cccc, dd/MM/yyyy HH:mm:ss")}
            <span className="font-mono text-xs">({now.zoneName})</span>
          </p>
        </CardBody>
      </Card>

      <div className="grid items-start gap-4 lg:grid-cols-2">
        <Card className="animate-fade-up">
          <CardHeader title="Epoch → Ngày giờ" subtitle="Chuyển timestamp thành ngày giờ dễ đọc" />
          <CardBody className="space-y-4">
            <Field label="Giá trị epoch" htmlFor="epoch-value">
              <TextInput
                id="epoch-value"
                inputMode="numeric"
                autoComplete="off"
                spellCheck={false}
                placeholder={`Ví dụ: ${nowSec}`}
                className="font-mono"
                value={epochInput}
                onChange={(e) => setEpochInput(e.target.value)}
              />
            </Field>
            <div>
              <p className="mb-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">Đơn vị</p>
              <Tabs items={UNIT_TABS} value={unit} onChange={setUnit} size="sm" />
            </div>

            {epochResult === null ? (
              <p className="rounded-lg bg-muted px-4 py-4 text-center text-sm text-muted-foreground">
                Nhập giá trị epoch để xem kết quả.
              </p>
            ) : "error" in epochResult ? (
              <p className="rounded-lg bg-danger/10 px-4 py-3 text-sm text-danger">{epochResult.error}</p>
            ) : (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">
                  Đơn vị nhận diện: <span className="font-medium text-foreground">{epochResult.unitLabel}</span>
                </p>
                <div className="divide-y divide-border rounded-xl border border-border">
                  <OutputRow
                    label="Giờ địa phương"
                    value={`${epochResult.dt.setLocale("vi").toFormat("cccc, dd/MM/yyyy HH:mm:ss")} (${epochResult.dt.zoneName ?? ""})`}
                  />
                  <OutputRow label="UTC" value={epochResult.dt.toUTC().toFormat("dd/MM/yyyy HH:mm:ss 'UTC'")} />
                  <OutputRow label="ISO 8601" value={epochResult.dt.toISO() ?? "—"} />
                  <OutputRow label="RFC 2822" value={epochResult.dt.toRFC2822() ?? "—"} />
                  <OutputRow
                    label="Tương đối"
                    value={epochResult.dt.setLocale("vi").toRelative({ base: now }) ?? "—"}
                  />
                </div>
              </div>
            )}
          </CardBody>
        </Card>

        <Card className="animate-fade-up">
          <CardHeader title="Ngày giờ → Epoch" subtitle="Chuyển ngày giờ thành timestamp" />
          <CardBody className="space-y-4">
            <Field label="Ngày giờ" htmlFor="epoch-date">
              <TextInput
                id="epoch-date"
                type="datetime-local"
                step={1}
                value={dateInput}
                onChange={(e) => setDateInput(e.target.value)}
              />
            </Field>
            <Field label="Múi giờ" htmlFor="epoch-zone">
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
                Nhập ngày giờ để xem kết quả.
              </p>
            ) : "error" in dateResult ? (
              <p className="rounded-lg bg-danger/10 px-4 py-3 text-sm text-danger">{dateResult.error}</p>
            ) : (
              <div className="divide-y divide-border rounded-xl border border-border">
                <OutputRow label="Giây (s)" value={String(Math.floor(dateResult.dt.toMillis() / 1000))} />
                <OutputRow label="Mili giây (ms)" value={String(dateResult.dt.toMillis())} />
                <div className="flex items-center gap-2 px-4 py-2.5 text-xs text-muted-foreground">
                  <ArrowDownUp className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  <span>
                    {dateResult.dt.setLocale("vi").toFormat("cccc, dd/MM/yyyy HH:mm:ss")} — UTC
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
