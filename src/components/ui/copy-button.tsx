"use client";

import { Check, Copy } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import type { Localized } from "@/lib/i18n";
import { useI18n } from "@/lib/i18n/use-lang";
import { cn } from "@/lib/utils";

const M = {
  copy: { vi: "Sao chép", en: "Copy" },
  copied: { vi: "Đã chép", en: "Copied" },
} satisfies Record<string, Localized>;

export function CopyButton({ text, className, label }: { text: string; className?: string; label?: string }) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard API unavailable (e.g. insecure context) — silently ignore
    }
  }, [text]);

  return (
    <button
      type="button"
      onClick={copy}
      aria-label={label ?? t(M.copy)}
      title={label ?? t(M.copy)}
      className={cn(
        "inline-flex h-7 items-center gap-1.5 rounded-md border border-border bg-card px-2 text-xs text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground",
        copied && "border-success/60 text-success",
        className,
      )}
    >
      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      {copied ? t(M.copied) : t(M.copy)}
    </button>
  );
}
