"use client";

import { Database, Eye, RefreshCw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Tabs } from "@/components/ui/tabs";
import { cn, formatNumber } from "@/lib/utils";

interface TrafficBucket {
  key: string;
  label: string;
  count: number;
}

interface TrafficStats {
  totalViews: number;
  hourly: TrafficBucket[];
  daily: TrafficBucket[];
  monthly: TrafficBucket[];
  yearly: TrafficBucket[];
  topPaths: Array<{ path: string; count: number }>;
  backend: "redis" | "memory";
  timezone: string;
}

type Period = "hourly" | "daily" | "monthly" | "yearly";

const PERIOD_ITEMS: Array<{ value: Period; label: string }> = [
  { value: "hourly", label: "Giờ" },
  { value: "daily", label: "Ngày" },
  { value: "monthly", label: "Tháng" },
  { value: "yearly", label: "Năm" },
];

const PERIOD_TITLES: Record<Period, string> = {
  hourly: "24 giờ gần nhất",
  daily: "30 ngày gần nhất",
  monthly: "12 tháng gần nhất",
  yearly: "5 năm gần nhất",
};

function StatTile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="card-surface p-4">
      <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 font-mono text-2xl font-bold">{value}</p>
      {hint ? <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function ChartTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ value?: number | string; payload?: TrafficBucket }>;
}) {
  if (!active || !payload?.length) return null;
  const bucket = payload[0]?.payload;
  if (!bucket) return null;
  return (
    <div className="card-surface px-3 py-2 text-xs shadow-lg">
      <p className="text-muted-foreground">{bucket.label}</p>
      <p className="mt-0.5 font-mono font-semibold">{formatNumber(bucket.count)} lượt xem</p>
    </div>
  );
}

export default function TrafficTool() {
  const [period, setPeriod] = useState<Period>("hourly");
  const [reloadKey, setReloadKey] = useState(0);
  // Result is tagged with the request key it answers; loading/error derive from it
  const [result, setResult] = useState<{ key: number; stats?: TrafficStats; error?: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/stats")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((data: TrafficStats) => {
        if (!cancelled) setResult({ key: reloadKey, stats: data });
      })
      .catch(() => {
        if (!cancelled) setResult({ key: reloadKey, error: "Không tải được thống kê. Vui lòng thử lại." });
      });
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  const stats = result?.stats ?? null;
  const loading = result?.key !== reloadKey;
  const error = !loading ? (result?.error ?? null) : null;
  const load = () => setReloadKey((k) => k + 1);

  const buckets = stats?.[period] ?? [];

  const { today, thisMonth } = useMemo(() => {
    if (!stats) return { today: 0, thisMonth: 0 };
    return {
      today: stats.daily.at(-1)?.count ?? 0,
      thisMonth: stats.monthly.at(-1)?.count ?? 0,
    };
  }, [stats]);

  const maxTopCount = stats?.topPaths[0]?.count ?? 1;

  if (error) {
    return (
      <div className="card-surface flex flex-col items-center gap-3 p-10 text-sm text-muted-foreground">
        {error}
        <Button variant="outline" size="sm" onClick={load}>
          Thử lại
        </Button>
      </div>
    );
  }

  if (loading && !stats) {
    return (
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="card-surface h-24 animate-pulse bg-muted/60" />
          ))}
        </div>
        <div className="card-surface h-80 animate-pulse bg-muted/60" />
      </div>
    );
  }

  if (!stats) return null;

  return (
    <div className="space-y-4">
      {/* ---- Overview tiles ---- */}
      <div className="grid gap-3 sm:grid-cols-3">
        <StatTile label="Tổng lượt xem" value={formatNumber(stats.totalViews)} hint="Từ khi triển khai" />
        <StatTile label="Hôm nay" value={formatNumber(today)} hint={`Múi giờ ${stats.timezone}`} />
        <StatTile label="Tháng này" value={formatNumber(thisMonth)} />
      </div>

      {/* ---- Chart ---- */}
      <Card>
        <CardHeader
          title="Lượt truy cập"
          subtitle={PERIOD_TITLES[period]}
          actions={
            <div className="flex items-center gap-2">
              <Tabs size="sm" items={PERIOD_ITEMS} value={period} onChange={setPeriod} />
              <Button variant="ghost" size="icon" aria-label="Tải lại" onClick={load}>
                <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
              </Button>
            </div>
          }
        />
        <CardBody>
          <div className="h-64 sm:h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={buckets} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                  tickLine={false}
                  axisLine={{ stroke: "var(--border)" }}
                  minTickGap={16}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                  tickLine={false}
                  axisLine={false}
                  width={44}
                  allowDecimals={false}
                />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: "var(--muted)", opacity: 0.5 }} />
                <Bar
                  dataKey="count"
                  fill="var(--chart-1)"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={28}
                  isAnimationActive={false}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardBody>
      </Card>

      {/* ---- Top pages ---- */}
      <Card>
        <CardHeader title="Trang được xem nhiều nhất" subtitle="Top 10 đường dẫn" />
        <CardBody className="px-0 pb-2 pt-0">
          {stats.topPaths.length === 0 ? (
            <p className="px-5 py-6 text-sm text-muted-foreground">Chưa có dữ liệu.</p>
          ) : (
            <table className="w-full text-sm">
              <tbody>
                {stats.topPaths.map((p, i) => (
                  <tr key={p.path} className="border-b border-border/60 last:border-0">
                    <td className="w-8 py-2.5 pl-5 font-mono text-xs text-muted-foreground">{i + 1}</td>
                    <td className="py-2.5">
                      <div className="relative">
                        <div
                          className="absolute inset-y-0 left-0 rounded bg-primary/10"
                          style={{ width: `${Math.max(4, (p.count / maxTopCount) * 100)}%` }}
                          aria-hidden
                        />
                        <span className="relative block truncate px-2 font-mono text-xs">{p.path}</span>
                      </div>
                    </td>
                    <td className="w-24 py-2.5 pr-5 text-right font-mono text-xs">{formatNumber(p.count)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardBody>
      </Card>

      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Database className="h-3.5 w-3.5" />
        Backend: {stats.backend === "redis" ? "Redis (Upstash)" : "Bộ nhớ tạm (dev — cấu hình Redis để lưu bền vững)"}
        <Eye className="ml-3 h-3.5 w-3.5" />
        Đếm theo pageview, không dùng cookie.
      </p>
    </div>
  );
}
