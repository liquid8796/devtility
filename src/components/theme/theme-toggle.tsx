"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";

import { useI18n } from "@/lib/i18n/use-lang";

const emptySubscribe = () => () => {};

/** true after hydration on the client, false during SSR — without effect-driven re-renders. */
function useMounted(): boolean {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );
}

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useMounted();
  const { lang } = useI18n();

  // Render a stable placeholder until mounted to avoid hydration mismatch
  if (!mounted) {
    return <div className="h-9 w-9 rounded-lg border border-border bg-card" aria-hidden />;
  }

  const isDark = resolvedTheme === "dark";

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label={
        isDark
          ? lang === "vi"
            ? "Chuyển sang chế độ sáng"
            : "Switch to light mode"
          : lang === "vi"
            ? "Chuyển sang chế độ tối"
            : "Switch to dark mode"
      }
      title={isDark ? "Light mode" : "Dark mode"}
      className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
    >
      {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  );
}
