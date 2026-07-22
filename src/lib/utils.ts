/** Join class names, skipping falsy values. */
export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}

/** Format a number for Vietnamese locale display. */
export function formatNumber(value: number, maximumFractionDigits = 6): string {
  if (!Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("vi-VN", { maximumFractionDigits }).format(value);
}
