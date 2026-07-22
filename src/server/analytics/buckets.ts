import { DateTime } from "luxon";

/** Timezone used for statistics bucketing (visitors are primarily Vietnamese). */
export const ANALYTICS_TZ = process.env.ANALYTICS_TZ ?? "Asia/Ho_Chi_Minh";

export interface BucketKeys {
  hour: string; // yyyyMMddHH
  day: string; // yyyyMMdd
  month: string; // yyyyMM
  year: string; // yyyy
}

export function bucketKeysFor(at: Date): BucketKeys {
  const dt = DateTime.fromJSDate(at, { zone: ANALYTICS_TZ });
  return {
    hour: dt.toFormat("yyyyMMddHH"),
    day: dt.toFormat("yyyyMMdd"),
    month: dt.toFormat("yyyyMM"),
    year: dt.toFormat("yyyy"),
  };
}

export interface BucketWindowEntry {
  key: string;
  label: string;
}

/** The rolling windows shown on the dashboard, oldest → newest. */
export function bucketWindows(now: Date = new Date()): {
  hours: BucketWindowEntry[];
  days: BucketWindowEntry[];
  months: BucketWindowEntry[];
  years: BucketWindowEntry[];
} {
  const dt = DateTime.fromJSDate(now, { zone: ANALYTICS_TZ });

  const hours = Array.from({ length: 24 }, (_, i) => {
    const d = dt.minus({ hours: 23 - i });
    return { key: d.toFormat("yyyyMMddHH"), label: d.toFormat("HH:00") };
  });
  const days = Array.from({ length: 30 }, (_, i) => {
    const d = dt.minus({ days: 29 - i });
    return { key: d.toFormat("yyyyMMdd"), label: d.toFormat("dd/MM") };
  });
  const months = Array.from({ length: 12 }, (_, i) => {
    const d = dt.minus({ months: 11 - i });
    return { key: d.toFormat("yyyyMM"), label: d.toFormat("MM/yyyy") };
  });
  const years = Array.from({ length: 5 }, (_, i) => {
    const d = dt.minus({ years: 4 - i });
    return { key: d.toFormat("yyyy"), label: d.toFormat("yyyy") };
  });

  return { hours, days, months, years };
}
