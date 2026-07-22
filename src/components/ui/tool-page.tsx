"use client";

import Link from "next/link";
import type { ReactNode } from "react";

import { useI18n } from "@/lib/i18n/use-lang";
import { getCategory, getTool } from "@/lib/registry/tools";

const M = {
  home: { vi: "Trang chủ", en: "Home" },
};

/**
 * Standard page chrome for every tool: breadcrumb, icon, title, description.
 * Looks the tool up from the registry itself (icon components are not
 * serializable across the server → client boundary).
 */
export function ToolPage({
  category,
  slug,
  children,
}: {
  category: string;
  slug: string;
  children: ReactNode;
}) {
  const { t } = useI18n();
  const tool = getTool(category, slug);
  if (!tool) return null;
  const cat = getCategory(tool.category);

  return (
    <div className="animate-fade-up">
      <nav aria-label="Breadcrumb" className="mb-4 flex items-center gap-1.5 text-xs text-muted-foreground">
        <Link href="/" className="transition-colors hover:text-foreground">
          {t(M.home)}
        </Link>
        <span aria-hidden>/</span>
        <span>{t(cat.name)}</span>
        <span aria-hidden>/</span>
        <span className="text-foreground">{t(tool.shortName)}</span>
      </nav>

      <div className="mb-6 flex items-start gap-4">
        <div className="hidden h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-border bg-card text-primary sm:flex">
          <tool.icon className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-xl font-bold tracking-tight sm:text-2xl">
            {t(tool.name)}
            {tool.status === "beta" ? (
              <span className="ml-2 inline-block rounded-full border border-accent/40 bg-accent/10 px-2 py-0.5 align-middle text-[10px] font-semibold uppercase tracking-wider text-accent">
                Beta
              </span>
            ) : null}
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{t(tool.description)}</p>
        </div>
      </div>

      {children}
    </div>
  );
}
