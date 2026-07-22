"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { CATEGORIES, getToolsByCategory } from "@/lib/registry/tools";
import { toolPath } from "@/lib/registry/types";
import { cn } from "@/lib/utils";

/** Registry-driven navigation list, shared by the desktop sidebar and the mobile drawer. */
export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <nav aria-label="Danh mục công cụ" className="space-y-6">
      {CATEGORIES.map((category) => {
        const tools = getToolsByCategory(category.id);
        if (tools.length === 0) return null;

        return (
          <div key={category.id}>
            <div className="mb-2 flex items-center gap-2 px-2 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
              <category.icon className="h-3.5 w-3.5" />
              {category.name}
            </div>
            <ul className="space-y-0.5">
              {tools.map((tool) => {
                const href = toolPath(tool);
                const active = pathname === href;
                return (
                  <li key={tool.slug}>
                    <Link
                      href={href}
                      onClick={onNavigate}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "group flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm transition-colors",
                        active
                          ? "bg-primary/10 font-medium text-primary"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground",
                      )}
                    >
                      <tool.icon
                        className={cn(
                          "h-4 w-4 shrink-0 transition-colors",
                          active ? "text-primary" : "text-muted-foreground/70 group-hover:text-foreground",
                        )}
                      />
                      <span className="truncate">{tool.shortName}</span>
                      {tool.status === "beta" ? (
                        <span className="ml-auto rounded-full bg-accent/15 px-1.5 py-px text-[9px] font-semibold uppercase text-accent">
                          β
                        </span>
                      ) : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </nav>
  );
}
