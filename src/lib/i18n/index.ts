/**
 * Lightweight client-side i18n (vi/en).
 *
 * Strings live next to the components that use them as `Localized` objects —
 * no extraction step, fully type-safe, tree-shaken per feature. The current
 * language is persisted in localStorage and shared app-wide through
 * `useSyncExternalStore` (SSR-safe: the server always renders Vietnamese,
 * React reconciles to the stored language right after hydration).
 */

export type Lang = "vi" | "en";

export const DEFAULT_LANG: Lang = "vi";

export interface Localized {
  vi: string;
  en: string;
}

export function t(text: Localized, lang: Lang): string {
  return text[lang];
}

/** Intl locale matching the UI language (numbers, dates). */
export function localeOf(lang: Lang): string {
  return lang === "vi" ? "vi-VN" : "en-US";
}
