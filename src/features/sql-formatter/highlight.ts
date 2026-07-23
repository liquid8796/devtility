/**
 * Tiny dependency-free SQL tokenizer used for two things:
 *  1. lightweight syntax highlighting of the output pane, and
 *  2. whitespace-safe minification (never touches strings, drops comments).
 *
 * Case-insensitive keyword matching; the original text is always preserved.
 */

export type TokenType =
  | "comment"
  | "string"
  | "number"
  | "keyword"
  | "function"
  | "punctuation"
  | "identifier"
  | "whitespace";

export interface Token {
  type: TokenType;
  text: string;
}

/** Curated common SQL keywords (checked case-insensitively). */
const KEYWORDS = new Set(
  [
    "SELECT", "FROM", "WHERE", "JOIN", "INNER", "LEFT", "RIGHT", "FULL", "OUTER",
    "CROSS", "ON", "GROUP", "ORDER", "BY", "HAVING", "INSERT", "UPDATE", "DELETE",
    "CREATE", "ALTER", "DROP", "TRUNCATE", "TABLE", "INDEX", "VIEW", "UNION",
    "ALL", "CASE", "WHEN", "THEN", "ELSE", "END", "LIMIT", "OFFSET", "WITH",
    "AS", "AND", "OR", "NOT", "NULL", "IN", "EXISTS", "BETWEEN", "LIKE", "ILIKE",
    "IS", "DISTINCT", "VALUES", "SET", "INTO", "PRIMARY", "KEY", "FOREIGN",
    "REFERENCES", "CONSTRAINT", "UNIQUE", "DEFAULT", "CHECK", "ASC", "DESC",
    "ADD", "COLUMN", "DATABASE", "SCHEMA", "GRANT", "REVOKE", "USE", "EXPLAIN",
    "ANALYZE", "BEGIN", "COMMIT", "ROLLBACK", "TRANSACTION", "DECLARE", "CURSOR",
    "FETCH", "PROCEDURE", "FUNCTION", "TRIGGER", "RETURNS", "RETURN", "IF",
    "WHILE", "LOOP", "FOR", "OVER", "PARTITION", "WINDOW", "ROW", "ROWS",
    "RANGE", "RECURSIVE", "USING", "NATURAL", "CAST", "TRUE", "FALSE", "TOP",
    "MERGE", "REPLACE", "INTERVAL", "CONFLICT", "RETURNING", "VARCHAR", "CHAR",
    "TEXT", "INT", "INTEGER", "BIGINT", "SMALLINT", "DECIMAL", "NUMERIC",
    "FLOAT", "REAL", "DOUBLE", "BOOLEAN", "DATE", "TIME", "TIMESTAMP",
  ],
);

export function isSqlKeyword(word: string): boolean {
  return KEYWORDS.has(word.toUpperCase());
}

const WORD_START = /[A-Za-z_]/;
const WORD_CHAR = /[A-Za-z0-9_$]/;

/** Read a quoted region ('…', "…", `…`) honoring doubled-quote escapes. */
function readQuoted(sql: string, start: number, quote: string): number {
  let i = start + 1;
  while (i < sql.length) {
    if (sql[i] === "\\" && quote === "'") {
      i += 2; // MySQL-style backslash escape inside single quotes
      continue;
    }
    if (sql[i] === quote) {
      if (sql[i + 1] === quote) {
        i += 2; // doubled quote escape ('' or "")
        continue;
      }
      return i + 1;
    }
    i += 1;
  }
  return sql.length; // unterminated — consume the rest, never crash
}

export function tokenizeSql(sql: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;

  while (i < sql.length) {
    const ch = sql[i];

    // -- line comment
    if (ch === "-" && sql[i + 1] === "-") {
      let end = sql.indexOf("\n", i);
      if (end === -1) end = sql.length;
      tokens.push({ type: "comment", text: sql.slice(i, end) });
      i = end;
      continue;
    }

    // /* block comment */
    if (ch === "/" && sql[i + 1] === "*") {
      const close = sql.indexOf("*/", i + 2);
      const end = close === -1 ? sql.length : close + 2;
      tokens.push({ type: "comment", text: sql.slice(i, end) });
      i = end;
      continue;
    }

    // '…' / "…" / `…` strings and quoted identifiers
    if (ch === "'" || ch === '"' || ch === "`") {
      const end = readQuoted(sql, i, ch);
      tokens.push({ type: "string", text: sql.slice(i, end) });
      i = end;
      continue;
    }

    // whitespace run
    if (/\s/.test(ch)) {
      let end = i + 1;
      while (end < sql.length && /\s/.test(sql[end])) end += 1;
      tokens.push({ type: "whitespace", text: sql.slice(i, end) });
      i = end;
      continue;
    }

    // number (integer, decimal, exponent)
    if (/[0-9]/.test(ch) || (ch === "." && /[0-9]/.test(sql[i + 1] ?? ""))) {
      const match = /^\d*\.?\d+(?:[eE][+-]?\d+)?/.exec(sql.slice(i));
      const text = match ? match[0] : ch;
      tokens.push({ type: "number", text });
      i += text.length;
      continue;
    }

    // word: keyword / function call / identifier
    if (WORD_START.test(ch)) {
      let end = i + 1;
      while (end < sql.length && WORD_CHAR.test(sql[end])) end += 1;
      const text = sql.slice(i, end);
      let type: TokenType = "identifier";
      if (isSqlKeyword(text)) {
        type = "keyword";
      } else {
        // peek past whitespace: word followed by "(" is a function call
        let peek = end;
        while (peek < sql.length && /[ \t]/.test(sql[peek])) peek += 1;
        if (sql[peek] === "(") type = "function";
      }
      tokens.push({ type, text });
      i = end;
      continue;
    }

    // everything else: single punctuation char
    tokens.push({ type: "punctuation", text: ch });
    i += 1;
  }

  return tokens;
}

/**
 * Minify SQL: collapse whitespace runs to single spaces (never inside strings),
 * drop comments entirely, trim the ends.
 */
export function minifySql(sql: string): string {
  const parts: string[] = [];
  for (const token of tokenizeSql(sql)) {
    if (token.type === "comment" || token.type === "whitespace") {
      // Collapse to a single separating space (comments are dropped entirely,
      // but neighbours must stay separated). Never merges adjacent separators.
      if (parts.length > 0 && parts[parts.length - 1] !== " ") parts.push(" ");
    } else {
      parts.push(token.text);
    }
  }
  return parts.join("").trim();
}
