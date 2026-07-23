/**
 * Shell-like tokenizer for the command-line arguments input.
 *
 * Mirrors POSIX word splitting closely enough for typical use:
 *   - whitespace separates arguments
 *   - "double quotes" and 'single quotes' group words (quotes are stripped)
 *   - backslash escapes the next character outside single quotes
 *
 * `hello "two words" 'it''s' a\ b` → ["hello", "two words", "its", "a b"]
 */
export function parseArgs(input: string): string[] {
  const args: string[] = [];
  let current = "";
  /** Whether the current token contains at least one character (so `""` yields an empty arg). */
  let hasToken = false;
  let quote: '"' | "'" | null = null;

  for (let i = 0; i < input.length; i++) {
    const ch = input[i];

    if (quote === "'") {
      if (ch === "'") quote = null;
      else current += ch;
      continue;
    }

    if (ch === "\\" && i + 1 < input.length) {
      current += input[++i];
      hasToken = true;
      continue;
    }

    if (quote === '"') {
      if (ch === '"') quote = null;
      else current += ch;
      continue;
    }

    if (ch === '"' || ch === "'") {
      quote = ch;
      hasToken = true;
      continue;
    }

    if (/\s/.test(ch)) {
      if (hasToken) {
        args.push(current);
        current = "";
        hasToken = false;
      }
      continue;
    }

    current += ch;
    hasToken = true;
  }

  // Unterminated quote: keep what was collected instead of throwing.
  if (hasToken) args.push(current);
  return args;
}
