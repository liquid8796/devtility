import Link from "next/link";
import type { ReactNode } from "react";

import { getCategory } from "@/lib/registry/tools";
import type { ToolDefinition } from "@/lib/registry/types";

/** Standard page chrome for every tool: breadcrumb, icon, title, description. */
export function ToolPage({ tool, children }: { tool: ToolDefinition; children: ReactNode }) {
  const category = getCategory(tool.category);

  return (
    <div className="animate-fade-up">
      <nav aria-label="Breadcrumb" className="mb-4 flex items-center gap-1.5 text-xs text-muted-foreground">
        <Link href="/" className="transition-colors hover:text-foreground">
          Trang chủ
        </Link>
        <span aria-hidden>/</span>
        <span>{category.name}</span>
        <span aria-hidden>/</span>
        <span className="text-foreground">{tool.shortName}</span>
      </nav>

      <div className="mb-6 flex items-start gap-4">
        <div className="hidden h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-border bg-card text-primary sm:flex">
          <tool.icon className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-xl font-bold tracking-tight sm:text-2xl">
            {tool.name}
            {tool.status === "beta" ? (
              <span className="ml-2 inline-block rounded-full border border-accent/40 bg-accent/10 px-2 py-0.5 align-middle text-[10px] font-semibold uppercase tracking-wider text-accent">
                Beta
              </span>
            ) : null}
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{tool.description}</p>
        </div>
      </div>

      {children}
    </div>
  );
}
