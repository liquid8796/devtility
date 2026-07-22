"use client";

import { ArrowLeftRight, RefreshCw, TrendingDown, TrendingUp } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { CopyButton } from "@/components/ui/copy-button";
import { Field, Select, TextInput } from "@/components/ui/field";
import { Tabs } from "@/components/ui/tabs";
import { dec, parseDecimal } from "@/lib/math/decimal";
import { cn } from "@/lib/utils";

import { formatCompact, formatRate, POPULAR_CRYPTO, POPULAR_FIAT } from "./format";

interface CurrencyInfo {
  code: string;
  name: string;
}

interface Snapshot {
  date: string;
  base: string;
  rates: Record<string, number>;
}

interface HistoryPoint {
  date: string;
  rate: number;
}

type Range = "7d" | "1m" | "3m" | "1y";

const RANGE_ITEMS: Array<{ value: Range; label: string }> = [
  { value: "7d", label: "7D" },
  { value: "1m", label: "1M" },
  { value: "3m", label: "3M" },
  { value: "1y", label: "1Y" },
];

function CurrencyOptions({ currencies }: { currencies: CurrencyInfo[] }) {
  const byCode = useMemo(() => new Map(currencies.map((c) => [c.code, c])), [currencies]);
  const popular = [...POPULAR_FIAT, ...POPULAR_CRYPTO].filter((c) => byCode.has(c));
  const popularSet = new Set(popular);
  const rest = currencies
    .filter((c) => !popularSet.has(c.code))
    .sort((a, b) => a.code.localeCompare(b.code));

  const render = (c: CurrencyInfo) => (
    <option key={c.code} value={c.code}>
      {c.code.toUpperCase()} — {c.name}
    </option>
  );

  return (
    <>
      <optgroup label="Phổ biến">{popular.map((code) => render(byCode.get(code)!))}</optgroup>
      <optgroup label="Tất cả">{rest.map(render)}</optgroup>
    </>
  );
}

function ChartTooltip({
  active,
  payload,
  quote,
}: {
  active?: boolean;
  payload?: Array<{ value?: number | string; payload?: HistoryPoint }>;
  quote: string;
}) {
  if (!active || !payload?.length) return null;
  const point = payload[0]?.payload;
  if (!point) return null;
  return (
    <div className="card-surface px-3 py-2 text-xs shadow-lg">
      <p className="text-muted-foreground">{point.date}</p>
      <p className="mt-0.5 font-mono font-semibold">
        {formatRate(point.rate)} <span className="text-muted-foreground">{quote.toUpperCase()}</span>
      </p>
    </div>
  );
}

export default function CurrencyTool() {
  const [currencies, setCurrencies] = useState<CurrencyInfo[]>([]);
  const [amountRaw, setAmountRaw] = useState("1");
  const [from, setFrom] = useState("usd");
  const [to, setTo] = useState("vnd");
  const [range, setRange] = useState<Range>("1m");
  const [reloadKey, setReloadKey] = useState(0);

  // Results are tagged with the request key they answer; loading/error states
  // are derived by comparing keys (avoids setState directly inside effects).
  const snapshotKey = `${from}|${reloadKey}`;
  const [snapshotResult, setSnapshotResult] = useState<{
    key: string;
    data?: Snapshot;
    error?: string;
  } | null>(null);

  const historyKey = `${from}|${to}|${range}|${reloadKey}`;
  const [historyResult, setHistoryResult] = useState<{
    key: string;
    points?: HistoryPoint[];
    error?: string;
  } | null>(null);

  // ---- currency list ----
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/rates/currencies", { signal: controller.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((data: { currencies: CurrencyInfo[] }) => setCurrencies(data.currencies))
      .catch(() => {
        // Fallback: still usable with the popular set
        setCurrencies(
          [...POPULAR_FIAT, ...POPULAR_CRYPTO].map((code) => ({ code, name: code.toUpperCase() })),
        );
      });
    return () => controller.abort();
  }, []);

  // ---- latest snapshot for the base currency ----
  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/rates/latest?base=${encodeURIComponent(from)}`, { signal: controller.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((data: Snapshot) => setSnapshotResult({ key: snapshotKey, data }))
      .catch((e: unknown) => {
        if (!(e instanceof DOMException && e.name === "AbortError")) {
          setSnapshotResult({ key: snapshotKey, error: "Không lấy được tỷ giá. Vui lòng thử lại." });
        }
      });
    return () => controller.abort();
  }, [from, snapshotKey]);

  // ---- pair history ----
  useEffect(() => {
    const controller = new AbortController();
    fetch(
      `/api/rates/history?base=${encodeURIComponent(from)}&quote=${encodeURIComponent(to)}&range=${range}`,
      { signal: controller.signal },
    )
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((data: { points: HistoryPoint[] }) => setHistoryResult({ key: historyKey, points: data.points }))
      .catch((e: unknown) => {
        if (!(e instanceof DOMException && e.name === "AbortError")) {
          setHistoryResult({ key: historyKey, error: "Không tải được dữ liệu biểu đồ." });
        }
      });
    return () => controller.abort();
  }, [from, to, range, historyKey]);

  const snapshot = snapshotResult?.data ?? null;
  const snapshotError = snapshotResult?.key === snapshotKey ? (snapshotResult.error ?? null) : null;
  const historyLoading = historyResult?.key !== historyKey;
  const history = useMemo(() => historyResult?.points ?? [], [historyResult]);
  const historyError = !historyLoading ? (historyResult?.error ?? null) : null;

  const amount = parseDecimal(amountRaw);
  const rate = snapshot?.rates[to];
  const converted =
    amount !== null && typeof rate === "number" ? amount.times(dec(rate)) : null;

  const changePct = useMemo(() => {
    if (history.length < 2) return null;
    const first = history[0].rate;
    const last = history[history.length - 1].rate;
    if (!Number.isFinite(first) || first === 0) return null;
    return ((last - first) / first) * 100;
  }, [history]);

  const swap = useCallback(() => {
    setFrom(to);
    setTo(from);
  }, [from, to]);

  const convertedText = converted !== null ? formatRate(converted.toNumber()) : "";

  return (
    <div className="space-y-4">
      {/* ---- Converter ---- */}
      <Card>
        <CardHeader
          title="Chuyển đổi tiền tệ"
          subtitle={snapshot ? `Cập nhật: ${snapshot.date} · nguồn mở fawazahmed0/exchange-api` : "Đang tải tỷ giá…"}
          actions={
            <Button variant="ghost" size="icon" aria-label="Tải lại tỷ giá" onClick={() => setReloadKey((k) => k + 1)}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          }
        />
        <CardBody>
          <div className="grid items-end gap-3 sm:grid-cols-[1fr_1fr_auto_1fr]">
            <Field label="Số tiền" htmlFor="cur-amount">
              <TextInput
                id="cur-amount"
                inputMode="decimal"
                value={amountRaw}
                onChange={(e) => setAmountRaw(e.target.value)}
                className="font-mono"
              />
            </Field>
            <Field label="Từ" htmlFor="cur-from">
              <Select id="cur-from" value={from} onChange={(e) => setFrom(e.target.value)}>
                <CurrencyOptions currencies={currencies} />
              </Select>
            </Field>
            <Button
              variant="outline"
              size="icon"
              onClick={swap}
              aria-label="Đảo chiều chuyển đổi"
              className="mb-0.5 justify-self-center"
            >
              <ArrowLeftRight className="h-4 w-4" />
            </Button>
            <Field label="Sang" htmlFor="cur-to">
              <Select id="cur-to" value={to} onChange={(e) => setTo(e.target.value)}>
                <CurrencyOptions currencies={currencies} />
              </Select>
            </Field>
          </div>

          <div className="mt-5 rounded-xl border border-border bg-muted/50 p-4">
            {snapshotError ? (
              <p className="text-sm text-danger">{snapshotError}</p>
            ) : amount === null ? (
              <p className="text-sm text-muted-foreground">Nhập số tiền hợp lệ để chuyển đổi.</p>
            ) : converted === null ? (
              <div className="h-12 w-2/3 animate-pulse rounded bg-muted" />
            ) : (
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="text-xs text-muted-foreground">
                    {formatRate(amount.toNumber())} {from.toUpperCase()} =
                  </p>
                  <p className="font-mono text-2xl font-bold sm:text-3xl">
                    {convertedText}{" "}
                    <span className="text-base font-semibold text-muted-foreground">{to.toUpperCase()}</span>
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    1 {from.toUpperCase()} = {formatRate(rate!)} {to.toUpperCase()} · 1 {to.toUpperCase()} ={" "}
                    {formatRate(1 / rate!)} {from.toUpperCase()}
                  </p>
                </div>
                <CopyButton text={convertedText} label="Sao chép kết quả" />
              </div>
            )}
          </div>
        </CardBody>
      </Card>

      {/* ---- Chart ---- */}
      <Card>
        <CardHeader
          title={`Biểu đồ ${from.toUpperCase()}/${to.toUpperCase()}`}
          subtitle={
            changePct !== null ? (
              <span className={cn("inline-flex items-center gap-1", changePct >= 0 ? "text-success" : "text-danger")}>
                {changePct >= 0 ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
                {changePct >= 0 ? "+" : ""}
                {changePct.toFixed(2)}% trong khoảng đã chọn
              </span>
            ) : (
              "Tỷ giá đóng cửa theo ngày"
            )
          }
          actions={<Tabs size="sm" items={RANGE_ITEMS} value={range} onChange={setRange} />}
        />
        <CardBody>
          {historyError ? (
            <div className="flex h-64 flex-col items-center justify-center gap-3 text-sm text-muted-foreground">
              {historyError}
              <Button variant="outline" size="sm" onClick={() => setReloadKey((k) => k + 1)}>
                Thử lại
              </Button>
            </div>
          ) : historyLoading && history.length === 0 ? (
            <div className="h-64 animate-pulse rounded-lg bg-muted" />
          ) : history.length === 0 ? (
            <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
              Chưa có dữ liệu lịch sử cho cặp tiền này.
            </div>
          ) : (
            <div className={cn("h-64 sm:h-72", historyLoading && "opacity-60 transition-opacity")}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={history} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                  <defs>
                    <linearGradient id="rateFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.25} />
                      <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                    tickLine={false}
                    axisLine={{ stroke: "var(--border)" }}
                    tickFormatter={(d: string) => d.slice(5).split("-").reverse().join("/")}
                    minTickGap={32}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                    tickLine={false}
                    axisLine={false}
                    width={56}
                    domain={["auto", "auto"]}
                    tickFormatter={(v: number) => formatCompact(v)}
                  />
                  <Tooltip
                    content={<ChartTooltip quote={to} />}
                    cursor={{ stroke: "var(--muted-foreground)", strokeDasharray: "4 4", strokeWidth: 1 }}
                  />
                  <Area
                    type="monotone"
                    dataKey="rate"
                    stroke="var(--chart-1)"
                    strokeWidth={2}
                    fill="url(#rateFill)"
                    dot={false}
                    activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--card)" }}
                    isAnimationActive={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
          <p className="mt-3 text-xs text-muted-foreground">
            Dữ liệu tổng hợp từ nguồn mở, cập nhật theo ngày — chỉ mang tính tham khảo, không phải tư vấn đầu tư.
          </p>
        </CardBody>
      </Card>
    </div>
  );
}
