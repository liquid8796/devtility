"use client";

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
import { RefreshButton } from "@/components/ui/refresh-button";
import { Tabs } from "@/components/ui/tabs";
import type { Localized } from "@/lib/i18n";
import { useI18n } from "@/lib/i18n/use-lang";
import { formatNumber } from "@/lib/utils";

const M = {
  hour: { vi: "Giờ", en: "Hour" },
  day: { vi: "Ngày", en: "Day" },
  month: { vi: "Tháng", en: "Month" },
  year: { vi: "Năm", en: "Year" },
  last24h: { vi: "24 giờ gần nhất", en: "Last 24 hours" },
  last30d: { vi: "30 ngày gần nhất", en: "Last 30 days" },
  last12m: { vi: "12 tháng gần nhất", en: "Last 12 months" },
  last5y: { vi: "5 năm gần nhất", en: "Last 5 years" },
  totalViews: { vi: "Tổng lượt xem", en: "Total views" },
  sinceLaunch: { vi: "Từ khi triển khai", en: "Since launch" },
  today: { vi: "Hôm nay", en: "Today" },
  timezone: { vi: "Múi giờ {tz}", en: "Timezone {tz}" },
  thisMonth: { vi: "Tháng này", en: "This month" },
  visits: { vi: "Lượt truy cập", en: "Visits" },
  reload: { vi: "Tải lại", en: "Reload" },
  views: { vi: "lượt xem", en: "views" },
  loadError: { vi: "Không tải được thống kê. Vui lòng thử lại.", en: "Could not load stats. Please try again." },
  retry: { vi: "Thử lại", en: "Retry" },
  topPages: { vi: "Trang được xem nhiều nhất", en: "Most viewed pages" },
  topPaths: { vi: "Top 10 đường dẫn", en: "Top 10 paths" },
  noData: { vi: "Chưa có dữ liệu.", en: "No data yet." },
} satisfies Record<string, Localized>;

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

const PERIOD_ITEMS: Array<{ value: Period; label: Localized }> = [
  { value: "hourly", label: M.hour },
  { value: "daily", label: M.day },
  { value: "monthly", label: M.month },
  { value: "yearly", label: M.year },
];

const PERIOD_TITLES: Record<Period, Localized> = {
  hourly: M.last24h,
  daily: M.last30d,
  monthly: M.last12m,
  yearly: M.last5y,
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
  const { t, locale } = useI18n();
  if (!active || !payload?.length) return null;
  const bucket = payload[0]?.payload;
  if (!bucket) return null;
  return (
    <div className="card-surface px-3 py-2 text-xs shadow-lg">
      <p className="text-muted-foreground">{bucket.label}</p>
      <p className="mt-0.5 font-mono font-semibold">
        {formatNumber(bucket.count, undefined, locale)} {t(M.views)}
      </p>
    </div>
  );
}

export default function TrafficTool() {
  const { t, locale } = useI18n();
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
        // Stored message doubles as the error flag; render translates via t(M.loadError).
        if (!cancelled) setResult({ key: reloadKey, error: M.loadError.vi });
      });
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  const periodItems = useMemo(
    () => PERIOD_ITEMS.map((item) => ({ value: item.value, label: t(item.label) })),
    [t],
  );

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
        {t(M.loadError)}
        <Button variant="outline" size="sm" onClick={load}>
          {t(M.retry)}
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
        <StatTile
          label={t(M.totalViews)}
          value={formatNumber(stats.totalViews, undefined, locale)}
          hint={t(M.sinceLaunch)}
        />
        <StatTile
          label={t(M.today)}
          value={formatNumber(today, undefined, locale)}
          hint={t(M.timezone).replace("{tz}", stats.timezone)}
        />
        <StatTile label={t(M.thisMonth)} value={formatNumber(thisMonth, undefined, locale)} />
      </div>

      {/* ---- Chart ---- */}
      <Card>
        <CardHeader
          title={t(M.visits)}
          subtitle={t(PERIOD_TITLES[period])}
          actions={
            <div className="flex items-center gap-2">
              <Tabs size="sm" items={periodItems} value={period} onChange={setPeriod} />
              <RefreshButton onClick={load} loading={loading} label={t(M.reload)} />
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
        <CardHeader title={t(M.topPages)} subtitle={t(M.topPaths)} />
        <CardBody className="px-0 pb-2 pt-0">
          {stats.topPaths.length === 0 ? (
            <p className="px-5 py-6 text-sm text-muted-foreground">{t(M.noData)}</p>
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
                    <td className="w-24 py-2.5 pr-5 text-right font-mono text-xs">
                      {formatNumber(p.count, undefined, locale)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
