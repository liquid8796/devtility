/**
 * Code-snippet generators for the regex tester (JavaScript / Java / Python).
 * Pure string helpers — no React, fully unit-testable.
 */

export type SnippetLang = "javascript" | "java" | "python";

/** Escape a pattern for embedding in a JS regex literal: escape bare `/`. */
function escapeForJsLiteral(pattern: string): string {
  return pattern.replace(/\\.|\//g, (m) => (m === "/" ? "\\/" : m));
}

/** Escape arbitrary text for a double-quoted JS string literal. */
function escapeJsString(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "\\r")
    .replace(/\t/g, "\\t");
}

/** Escape arbitrary text for a double-quoted Java string literal. */
function escapeJavaString(text: string): string {
  return escapeJsString(text);
}

/**
 * Quote a string for Python, preferring raw strings (needed for regex).
 * Falls back to an escaped plain string when both quote styles collide.
 */
function pythonQuote(text: string): string {
  if (!text.includes('"') && !text.endsWith("\\") && !text.includes("\n")) return `r"${text}"`;
  if (!text.includes("'") && !text.endsWith("\\") && !text.includes("\n")) return `r'${text}'`;
  return `"${escapeJsString(text)}"`;
}

/** `$1` → `\1`, `$<name>` → `\g<name>`, `$&` → `\g<0>` for Python re.sub. */
function toPythonReplacement(replacement: string): string {
  return replacement
    .replace(/\\/g, "\\\\")
    .replace(/\$\$/g, "$")
    .replace(/\$&/g, "\\g<0>")
    .replace(/\$<([A-Za-z_][A-Za-z0-9_]*)>/g, "\\g<$1>")
    .replace(/\$(\d+)/g, "\\$1");
}

/** `$<name>` → `${name}` for Java Matcher.replaceAll. */
function toJavaReplacement(replacement: string): string {
  return replacement.replace(/\$<([A-Za-z_][A-Za-z0-9_]*)>/g, "${$1}");
}

export function buildJsSnippet(pattern: string, flags: string, replacement: string): string {
  const literal = `/${escapeForJsLiteral(pattern) || "(?:)"}/${flags}`;
  const lines: string[] = [
    `const re = ${literal};`,
    `const text = "...";`,
    "",
  ];
  if (flags.includes("g")) {
    lines.push(
      "for (const match of text.matchAll(re)) {",
      "  console.log(match[0], match.index, match.groups);",
      "}",
    );
  } else {
    lines.push(
      "const match = text.match(re);",
      "if (match) {",
      "  console.log(match[0], match.index, match.groups);",
      "}",
    );
  }
  if (replacement !== "") {
    lines.push("", `const result = text.replace(re, "${escapeJsString(replacement)}");`);
  }
  return lines.join("\n");
}

const JAVA_FLAG_MAP: ReadonlyArray<[string, string]> = [
  ["i", "Pattern.CASE_INSENSITIVE"],
  ["m", "Pattern.MULTILINE"],
  ["s", "Pattern.DOTALL"],
];

export function buildJavaSnippet(pattern: string, flags: string, replacement: string): string {
  const javaFlags = JAVA_FLAG_MAP.filter(([f]) => flags.includes(f)).map(([, name]) => name);
  const flagArg = javaFlags.length > 0 ? `, ${javaFlags.join(" | ")}` : "";
  const lines: string[] = [
    "import java.util.regex.Matcher;",
    "import java.util.regex.Pattern;",
    "",
    `Pattern pattern = Pattern.compile("${escapeJavaString(pattern)}"${flagArg});`,
    `Matcher matcher = pattern.matcher(text);`,
    "while (matcher.find()) {",
    "    System.out.println(matcher.group() + \" @ \" + matcher.start());",
    "}",
  ];
  if (replacement !== "") {
    lines.push(
      "",
      `String result = matcher.replaceAll("${escapeJavaString(toJavaReplacement(replacement))}");`,
    );
  }
  return lines.join("\n");
}

const PYTHON_FLAG_MAP: ReadonlyArray<[string, string]> = [
  ["i", "re.I"],
  ["m", "re.M"],
  ["s", "re.S"],
];

export function buildPythonSnippet(pattern: string, flags: string, replacement: string): string {
  const pyFlags = PYTHON_FLAG_MAP.filter(([f]) => flags.includes(f)).map(([, name]) => name);
  const flagArg = pyFlags.length > 0 ? `, ${pyFlags.join(" | ")}` : "";
  const lines: string[] = [
    "import re",
    "",
    `pattern = re.compile(${pythonQuote(pattern)}${flagArg})`,
    "",
    "for m in pattern.finditer(text):",
    "    print(m.group(0), m.start(), m.groupdict())",
  ];
  if (replacement !== "") {
    lines.push("", `result = pattern.sub(${pythonQuote(toPythonReplacement(replacement))}, text)`);
  }
  return lines.join("\n");
}

export function buildSnippet(lang: SnippetLang, pattern: string, flags: string, replacement: string): string {
  if (lang === "java") return buildJavaSnippet(pattern, flags, replacement);
  if (lang === "python") return buildPythonSnippet(pattern, flags, replacement);
  return buildJsSnippet(pattern, flags, replacement);
}
