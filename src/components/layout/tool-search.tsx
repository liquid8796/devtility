"use client";

import { Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import type { Localized } from "@/lib/i18n";
import { useI18n } from "@/lib/i18n/use-lang";
import { highlightRange, searchTools } from "@/lib/registry/search";
import { CATEGORIES } from "@/lib/registry/tools";
import { toolPath, type Category, type ToolDefinition } from "@/lib/registry/types";
import { cn } from "@/lib/utils";

const M = {
  searchButton: { vi: "Tìm công cụ…", en: "Search tools…" },
  dialogLabel: { vi: "Tìm kiếm công cụ", en: "Tool search" },
  placeholder: {
    vi: "Gõ tên công cụ hoặc từ khóa… (không cần dấu)",
    en: "Type a tool name or keyword…",
  },
  noResults: { vi: "Không tìm thấy công cụ phù hợp.", en: "No matching tools." },
  hintNavigate: { vi: "di chuyển", en: "navigate" },
  hintOpen: { vi: "mở", en: "open" },
  hintClose: { vi: "đóng", en: "close" },
} satisfies Record<string, Localized>;

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex items-center rounded border border-border bg-muted px-1.5 py-px font-mono text-[10px] text-muted-foreground">
      {children}
    </kbd>
  );
}

function Highlight({ text, range }: { text: string; range: [number, number] | null }) {
  if (!range) return <>{text}</>;
  const [start, end] = range;
  return (
    <>
      {text.slice(0, start)}
      <mark className="rounded-sm bg-primary/20 font-medium text-inherit">{text.slice(start, end)}</mark>
      {text.slice(end)}
    </>
  );
}

/**
 * Header search: a button that opens a command palette (Ctrl/⌘+K) filtering
 * the tool registry — diacritics-insensitive, keyboard-first.
 */
export function ToolSearch() {
  const router = useRouter();
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);

  const results = useMemo(() => searchTools(query), [query]);

  // Regroup the flat ranked list by category for display, keeping flat indexes for keyboard nav
  const grouped = useMemo(() => {
    const byCategory = new Map<Category, Array<{ tool: ToolDefinition; flatIndex: number }>>();
    results.forEach(({ tool }, flatIndex) => {
      const category = CATEGORIES.find((c) => c.id === tool.category)!;
      const bucket = byCategory.get(category) ?? [];
      bucket.push({ tool, flatIndex });
      byCategory.set(category, bucket);
    });
    return [...byCategory.entries()].map(([category, items]) => ({ category, items }));
  }, [results]);

  // Global shortcut: Ctrl/⌘+K toggles the palette
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // Lock body scroll while the palette is open (same pattern as the mobile drawer)
  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  // Keep the active option visible while navigating with the keyboard
  useEffect(() => {
    document.getElementById(`tool-search-opt-${active}`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  const close = () => {
    setOpen(false);
    setQuery("");
    setActive(0);
  };

  const select = (tool: ToolDefinition) => {
    close();
    router.push(toolPath(tool));
  };

  const onInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((v) => Math.min(v + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((v) => Math.max(v - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const hit = results[active] ?? results[0];
      if (hit) select(hit.tool);
    } else if (e.key === "Escape") {
      e.preventDefault();
      close();
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t(M.dialogLabel)}
        title={`${t(M.searchButton)} (Ctrl+K)`}
        className="inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-card px-2.5 text-sm text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
      >
        <Search className="h-4 w-4" />
        <span className="hidden md:inline">{t(M.searchButton)}</span>
        <span className="hidden md:inline-flex">
          <Kbd>Ctrl K</Kbd>
        </span>
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-[10vh] sm:pt-[16vh]"
          role="dialog"
          aria-modal="true"
          aria-label={t(M.dialogLabel)}
        >
          <div className="absolute inset-0 bg-black/45 backdrop-blur-sm" onClick={close} aria-hidden />
          <div className="relative w-full max-w-xl overflow-hidden rounded-xl border border-border bg-card shadow-2xl">
            <div className="flex items-center gap-2 border-b border-border px-3">
              <Search className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
              <input
                autoFocus
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setActive(0);
                }}
                onKeyDown={onInputKeyDown}
                placeholder={t(M.placeholder)}
                className="h-12 w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground/70"
                role="combobox"
                aria-expanded="true"
                aria-controls="tool-search-listbox"
                aria-activedescendant={results.length > 0 ? `tool-search-opt-${active}` : undefined}
                aria-label={t(M.dialogLabel)}
              />
              <Kbd>Esc</Kbd>
            </div>

            <div id="tool-search-listbox" role="listbox" className="max-h-[55vh] overflow-y-auto p-2">
              {results.length === 0 ? (
                <p className="px-3 py-8 text-center text-sm text-muted-foreground">{t(M.noResults)}</p>
              ) : (
                grouped.map(({ category, items }) => (
                  <div key={category.id} role="group" aria-label={t(category.name)}>
                    <div className="flex items-center gap-1.5 px-2 pb-1 pt-2.5 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                      <category.icon className="h-3.5 w-3.5" aria-hidden />
                      {t(category.name)}
                    </div>
                    {items.map(({ tool, flatIndex }) => (
                      <div
                        key={tool.slug}
                        id={`tool-search-opt-${flatIndex}`}
                        role="option"
                        aria-selected={flatIndex === active}
                        onMouseEnter={() => setActive(flatIndex)}
                        onClick={() => select(tool)}
                        className={cn(
                          "flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-2 text-sm transition-colors",
                          flatIndex === active ? "bg-primary/10 text-primary" : "text-foreground",
                        )}
                      >
                        <tool.icon
                          className={cn(
                            "h-4 w-4 shrink-0",
                            flatIndex === active ? "text-primary" : "text-muted-foreground/70",
                          )}
                        />
                        <span className="truncate">
                          <Highlight text={t(tool.name)} range={highlightRange(t(tool.name), query)} />
                        </span>
                        {tool.status === "beta" ? (
                          <span className="rounded-full bg-accent/15 px-1.5 py-px text-[9px] font-semibold uppercase text-accent">
                            β
                          </span>
                        ) : null}
                      </div>
                    ))}
                  </div>
                ))
              )}
            </div>

            <div className="flex items-center gap-3 border-t border-border px-3 py-2 text-[11px] text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <Kbd>↑</Kbd>
                <Kbd>↓</Kbd> {t(M.hintNavigate)}
              </span>
              <span className="inline-flex items-center gap-1">
                <Kbd>Enter</Kbd> {t(M.hintOpen)}
              </span>
              <span className="inline-flex items-center gap-1">
                <Kbd>Esc</Kbd> {t(M.hintClose)}
              </span>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
