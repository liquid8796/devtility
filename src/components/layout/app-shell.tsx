"use client";

import { Menu, TerminalSquare, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

import { LanguageToggle } from "@/components/i18n/language-toggle";
import { SidebarNav } from "@/components/layout/sidebar-nav";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { useI18n } from "@/lib/i18n/use-lang";
import { SITE } from "@/lib/registry/tools";

const M = {
  home: { vi: "Trang chủ", en: "Home" },
  openMenu: { vi: "Mở menu", en: "Open menu" },
  closeMenu: { vi: "Đóng menu", en: "Close menu" },
  license: {
    vi: "Chỉ dùng phi thương mại (PolyForm NC 1.0.0)",
    en: "Non-commercial use only (PolyForm NC 1.0.0)",
  },
};

function Logo() {
  const { t } = useI18n();
  return (
    <Link href="/" className="flex items-center gap-2.5" aria-label={`${SITE.name} — ${t(M.home)}`}>
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-(--primary) to-(--accent) text-white shadow-sm">
        <TerminalSquare className="h-4.5 w-4.5" />
      </span>
      <span className="font-mono text-lg font-bold tracking-tight">
        Dev<span className="text-gradient">Tility</span>
      </span>
    </Link>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const pathname = usePathname();
  const { t } = useI18n();

  // Close the mobile drawer on navigation (adjust-state-during-render pattern)
  const [prevPathname, setPrevPathname] = useState(pathname);
  if (prevPathname !== pathname) {
    setPrevPathname(pathname);
    setDrawerOpen(false);
  }

  // Lock body scroll while the drawer is open
  useEffect(() => {
    document.body.style.overflow = drawerOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [drawerOpen]);

  return (
    <div className="bg-tech flex min-h-dvh flex-col">
      {/* ---- Header ---- */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/75 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-[1440px] items-center gap-3 px-4 sm:px-6">
          <button
            type="button"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground lg:hidden"
            aria-label={drawerOpen ? t(M.closeMenu) : t(M.openMenu)}
            aria-expanded={drawerOpen}
            onClick={() => setDrawerOpen((v) => !v)}
          >
            {drawerOpen ? <X className="h-4.5 w-4.5" /> : <Menu className="h-4.5 w-4.5" />}
          </button>

          <Logo />

          <div className="ml-auto flex items-center gap-2">
            <span className="hidden font-mono text-[11px] text-muted-foreground md:inline">
              ~/tools <span className="cursor-blink" />
            </span>
            <LanguageToggle />
            <ThemeToggle />
          </div>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-[1440px] flex-1">
        {/* ---- Desktop sidebar ---- */}
        <aside className="sticky top-14 hidden h-[calc(100dvh-3.5rem)] w-60 shrink-0 overflow-y-auto border-r border-border/60 px-3 py-5 lg:block">
          <SidebarNav />
        </aside>

        {/* ---- Mobile drawer ---- */}
        {drawerOpen ? (
          <div className="fixed inset-0 z-30 lg:hidden" role="dialog" aria-modal="true">
            <div
              className="absolute inset-0 bg-black/45 backdrop-blur-sm"
              onClick={() => setDrawerOpen(false)}
              aria-hidden
            />
            <div className="absolute inset-y-0 left-0 top-14 w-72 max-w-[85vw] overflow-y-auto border-r border-border bg-background px-3 py-5 shadow-2xl">
              <SidebarNav onNavigate={() => setDrawerOpen(false)} />
            </div>
          </div>
        ) : null}

        {/* ---- Main ---- */}
        <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>

      {/* ---- Footer ---- */}
      <footer className="border-t border-border/60">
        <div className="mx-auto flex max-w-[1440px] flex-col items-center justify-between gap-2 px-4 py-5 text-xs text-muted-foreground sm:flex-row sm:px-6">
          <p>
            © {new Date().getFullYear()} {SITE.author} — {t(M.license)}
          </p>
          <p className="font-mono">
            build with <span className="text-danger">♥</span> · Next.js · Vercel
          </p>
        </div>
      </footer>
    </div>
  );
}
