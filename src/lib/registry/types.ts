import type { LucideIcon } from "lucide-react";

/**
 * Central domain model for the tool registry.
 *
 * Every page/feature of the site is a "Tool" that belongs to a "Category".
 * Navigation (sidebar, home page, mobile menu, breadcrumbs, static params)
 * is derived entirely from this registry — adding a new tool only requires:
 *   1. a new entry in `tools.ts`
 *   2. a feature component registered in `src/features/registry.tsx`
 */

export type CategoryId = "converters" | "utilities" | "technology" | "insights";

export interface Category {
  id: CategoryId;
  /** Display name (Vietnamese-first) */
  name: string;
  /** Short tagline shown on the home page */
  tagline: string;
  icon: LucideIcon;
  /** Sort order in navigation */
  order: number;
}

export interface ToolDefinition {
  /** URL slug, unique across the whole site */
  slug: string;
  category: CategoryId;
  name: string;
  /** Compact name for the sidebar */
  shortName: string;
  description: string;
  icon: LucideIcon;
  keywords: string[];
  status?: "stable" | "beta";
}

export function toolPath(tool: Pick<ToolDefinition, "category" | "slug">): string {
  return `/tools/${tool.category}/${tool.slug}`;
}
