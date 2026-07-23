"use client";

import { type KeyboardEvent, useRef } from "react";

import { cn } from "@/lib/utils";

export interface TabItem<T extends string = string> {
  value: T;
  label: string;
}

/** Controlled segmented tabs. */
export function Tabs<T extends string>({
  items,
  value,
  onChange,
  className,
  size = "md",
}: {
  items: ReadonlyArray<TabItem<T>>;
  value: T;
  onChange: (value: T) => void;
  className?: string;
  size?: "sm" | "md";
}) {
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // Standard tablist keyboard pattern: roving tabindex, arrow keys with
  // wrap-around, Home/End; selection follows focus.
  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (event.ctrlKey || event.altKey || event.metaKey) return;
    let next: number;
    switch (event.key) {
      case "ArrowLeft":
        next = (index - 1 + items.length) % items.length;
        break;
      case "ArrowRight":
        next = (index + 1) % items.length;
        break;
      case "Home":
        next = 0;
        break;
      case "End":
        next = items.length - 1;
        break;
      default:
        return;
    }
    event.preventDefault();
    const item = items[next];
    if (!item) return;
    onChange(item.value);
    tabRefs.current[next]?.focus();
  };

  return (
    <div
      role="tablist"
      className={cn(
        "inline-flex max-w-full items-center gap-1 overflow-x-auto rounded-xl border border-border bg-muted p-1",
        className,
      )}
    >
      {items.map((item, index) => {
        const active = item.value === value;
        return (
          <button
            key={item.value}
            ref={(el) => {
              tabRefs.current[index] = el;
            }}
            role="tab"
            type="button"
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(item.value)}
            onKeyDown={(event) => handleKeyDown(event, index)}
            className={cn(
              "shrink-0 rounded-lg font-medium transition-all",
              size === "sm" ? "px-2.5 py-1 text-xs" : "px-3.5 py-1.5 text-sm",
              active
                ? "bg-card text-foreground shadow-sm ring-1 ring-border"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
