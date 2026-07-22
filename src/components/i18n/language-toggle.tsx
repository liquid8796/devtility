"use client";

import { Languages } from "lucide-react";
import { useEffect } from "react";

import { useI18n } from "@/lib/i18n/use-lang";

export function LanguageToggle() {
  const { lang, setLang } = useI18n();

  // Keep <html lang> in sync with the restored preference (external system → effect is fine)
  useEffect(() => {
    if (document.documentElement.lang !== lang) document.documentElement.lang = lang;
  }, [lang]);

  const next = lang === "vi" ? "en" : "vi";

  return (
    <button
      type="button"
      onClick={() => setLang(next)}
      aria-label={lang === "vi" ? "Switch to English" : "Chuyển sang tiếng Việt"}
      title={lang === "vi" ? "Switch to English" : "Chuyển sang tiếng Việt"}
      className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 font-mono text-xs font-semibold uppercase text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
    >
      <Languages className="h-4 w-4" />
      {lang}
    </button>
  );
}
