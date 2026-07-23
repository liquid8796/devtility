import { TOOLS } from "./tools";
import type { ToolDefinition } from "./types";

/**
 * Registry search used by the header command palette.
 * Pure functions — no React, unit-testable.
 */

/**
 * Case + Vietnamese-diacritics fold with a strict 1:1 character mapping
 * ("Múi giờ" → "mui gio", "Đơn vị" → "don vi"), so an index found in the
 * folded string highlights the same range in the original.
 */
export function foldVi(text: string): string {
  let out = "";
  for (const ch of text.toLowerCase()) {
    if (ch === "đ") {
      out += "d";
      continue;
    }
    // NFD splits "ệ" into "e" + combining marks; keep only the base character.
    out += ch.normalize("NFD")[0];
  }
  return out;
}

export interface ToolSearchResult {
  tool: ToolDefinition;
  /** Lower is better; ties keep registry order (already grouped by category) */
  score: number;
}

/** Per-token relevance: exact-ish name hits rank above keyword and description hits. */
function tokenScore(token: string, tool: ToolDefinition): number | null {
  const names = [tool.shortName.vi, tool.shortName.en, tool.name.vi, tool.name.en].map(foldVi);
  if (names.some((n) => n.startsWith(token))) return 0;
  if (names.some((n) => n.includes(token))) return 1;
  const keywords = [tool.slug, ...tool.keywords].map(foldVi);
  if (keywords.some((k) => k.includes(token))) return 2;
  const descriptions = [tool.description.vi, tool.description.en].map(foldVi);
  if (descriptions.some((d) => d.includes(token))) return 3;
  return null;
}

/**
 * All whitespace-separated tokens must match (AND). An empty query returns the
 * whole registry so the palette doubles as a quick browser.
 */
export function searchTools(query: string): ToolSearchResult[] {
  const tokens = foldVi(query).split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return TOOLS.map((tool) => ({ tool, score: 0 }));

  const results: Array<ToolSearchResult & { index: number }> = [];
  TOOLS.forEach((tool, index) => {
    let score = 0;
    for (const token of tokens) {
      const s = tokenScore(token, tool);
      if (s === null) return;
      score += s;
    }
    results.push({ tool, score, index });
  });

  return results
    .sort((a, b) => a.score - b.score || a.index - b.index)
    .map(({ tool, score }) => ({ tool, score }));
}

/** Range of the first token hit inside `text` (for <mark> highlighting), or null. */
export function highlightRange(text: string, query: string): [number, number] | null {
  const folded = foldVi(text);
  for (const token of foldVi(query).split(/\s+/).filter(Boolean)) {
    const at = folded.indexOf(token);
    if (at !== -1) return [at, at + token.length];
  }
  return null;
}
