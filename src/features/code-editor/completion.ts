import {
  autocompletion,
  completeAnyWord,
  completeFromList,
  snippetCompletion,
  type Completion,
  type CompletionSource,
} from "@codemirror/autocomplete";
import { javaLanguage } from "@codemirror/lang-java";
import {
  javascriptLanguage,
  localCompletionSource as jsLocalCompletion,
  scopeCompletionSource,
  snippets as jsKeywordSnippets,
} from "@codemirror/lang-javascript";
import { pythonLanguage } from "@codemirror/lang-python";
import type { Extension } from "@codemirror/state";

import type { SupportedLanguage } from "@/server/execute/types";

/**
 * IntelliJ-style completion for the online editor.
 *
 *  - "basic": identifiers already in the document + language keywords
 *    (IntelliJ's Basic Completion / Ctrl+Space).
 *  - "smart": basic + live templates (sout, psvm, fori…), common stdlib
 *    symbols/members and scope-aware sources (IntelliJ's Smart Completion).
 *  - "off":   no popup at all.
 *
 * Everything is wired through CodeMirror's languageData so sources only fire
 * for their own language.
 */

export type CompletionMode = "off" | "basic" | "smart";

// ---------------------------------------------------------------------------
// Generic helpers

function keywordList(words: string[], boost = 0): Completion[] {
  return words.map((label) => ({ label, type: "keyword", boost }));
}

function typeList(words: string[]): Completion[] {
  return words.map((label) => ({ label, type: "class", boost: 1 }));
}

/** Completions offered right after a `.` — curated common member names. */
function memberSource(members: Completion[]): CompletionSource {
  return (context) => {
    const match = context.matchBefore(/\.[A-Za-z_$]*$/);
    if (!match) return null;
    return { from: match.from + 1, options: members, validFor: /^[\w$]*$/ };
  };
}

function methodList(names: string[]): Completion[] {
  return names.map((n) => ({
    label: n.endsWith("()") ? n.slice(0, -2) : n,
    apply: n.endsWith("()") ? `${n.slice(0, -2)}()` : n,
    detail: n.endsWith("()") ? "method" : "field",
    type: n.endsWith("()") ? "method" : "property",
  }));
}

// ---------------------------------------------------------------------------
// Java

const JAVA_KEYWORDS = [
  "abstract", "assert", "boolean", "break", "byte", "case", "catch", "char", "class",
  "continue", "default", "do", "double", "else", "enum", "extends", "final", "finally",
  "float", "for", "if", "implements", "import", "instanceof", "int", "interface", "long",
  "native", "new", "package", "private", "protected", "public", "record", "return",
  "sealed", "short", "static", "super", "switch", "synchronized", "this", "throw",
  "throws", "transient", "try", "var", "void", "volatile", "while", "yield",
  "true", "false", "null",
];

const JAVA_TYPES = [
  "String", "System", "Math", "Object", "Integer", "Long", "Double", "Boolean",
  "Character", "Byte", "Short", "Float", "StringBuilder", "Scanner", "ArrayList",
  "LinkedList", "List", "Map", "HashMap", "TreeMap", "Set", "HashSet", "TreeSet",
  "Arrays", "Collections", "Optional", "Stream", "IntStream", "Collectors",
  "Exception", "RuntimeException", "IllegalArgumentException", "Thread", "Runnable",
  "BigDecimal", "BigInteger", "LocalDate", "LocalDateTime", "Duration", "Random",
  "UUID", "Pattern", "Matcher", "Iterable", "Comparable", "Comparator",
];

const JAVA_MEMBERS = methodList([
  "println()", "print()", "printf()", "out", "err", "in", "length()", "length",
  "size()", "get()", "set()", "add()", "remove()", "put()", "contains()",
  "containsKey()", "containsValue()", "isEmpty()", "equals()", "hashCode()",
  "toString()", "charAt()", "substring()", "indexOf()", "split()", "trim()",
  "strip()", "toLowerCase()", "toUpperCase()", "replace()", "valueOf()",
  "parseInt()", "parseDouble()", "format()", "join()", "stream()", "forEach()",
  "map()", "filter()", "collect()", "sorted()", "count()", "sum()", "min()",
  "max()", "abs()", "pow()", "sqrt()", "floor()", "ceil()", "round()", "random()",
  "keySet()", "values()", "entrySet()", "getOrDefault()", "append()", "reverse()",
  "next()", "nextInt()", "nextLine()", "hasNext()", "close()", "sort()", "asList()",
  "copyOf()", "of()", "toArray()", "compareTo()",
]);

/** IntelliJ live templates, same abbreviations (sout, psvm, fori, iter…). */
const JAVA_SNIPPETS: Completion[] = [
  snippetCompletion("System.out.println(${});", {
    label: "sout", detail: "System.out.println();", type: "function", boost: 3,
  }),
  snippetCompletion("System.err.println(${});", {
    label: "serr", detail: "System.err.println();", type: "function", boost: 2,
  }),
  snippetCompletion('System.out.printf("${format}"${});', {
    label: "souf", detail: "System.out.printf();", type: "function", boost: 2,
  }),
  snippetCompletion("public static void main(String[] args) {\n\t${}\n}", {
    label: "psvm", detail: "main() method", type: "function", boost: 3,
  }),
  snippetCompletion("public static void main(String[] args) {\n\t${}\n}", {
    label: "main", detail: "main() method", type: "function", boost: 2,
  }),
  snippetCompletion("for (int ${i} = 0; ${i} < ${limit}; ${i}++) {\n\t${}\n}", {
    label: "fori", detail: "indexed for loop", type: "keyword", boost: 2,
  }),
  snippetCompletion("for (${Type} ${item} : ${collection}) {\n\t${}\n}", {
    label: "iter", detail: "for-each loop", type: "keyword", boost: 2,
  }),
  snippetCompletion("if (${expr} == null) {\n\t${}\n}", {
    label: "ifn", detail: "if null", type: "keyword",
  }),
  snippetCompletion("if (${expr} != null) {\n\t${}\n}", {
    label: "inn", detail: "if not null", type: "keyword",
  }),
  snippetCompletion("try {\n\t${}\n} catch (${Exception} e) {\n\t${}\n}", {
    label: "try", detail: "try / catch", type: "keyword",
  }),
  snippetCompletion("while (${condition}) {\n\t${}\n}", {
    label: "wh", detail: "while loop", type: "keyword",
  }),
  snippetCompletion("switch (${value}) {\n\tcase ${} -> ${};\n\tdefault -> ${};\n}", {
    label: "sw", detail: "switch expression", type: "keyword",
  }),
  snippetCompletion("private ${Type} ${name};", {
    label: "prf", detail: "private field", type: "keyword",
  }),
];

// ---------------------------------------------------------------------------
// Python

const PYTHON_KEYWORDS = [
  "and", "as", "assert", "async", "await", "break", "class", "continue", "def",
  "del", "elif", "else", "except", "finally", "for", "from", "global", "if",
  "import", "in", "is", "lambda", "match", "nonlocal", "not", "or", "pass",
  "raise", "return", "try", "while", "with", "yield", "True", "False", "None",
];

const PYTHON_BUILTINS = [
  "print", "input", "len", "range", "enumerate", "zip", "map", "filter", "sorted",
  "reversed", "sum", "min", "max", "abs", "round", "int", "float", "str", "bool",
  "list", "tuple", "dict", "set", "frozenset", "type", "isinstance", "issubclass",
  "open", "repr", "format", "hash", "id", "iter", "next", "super", "any", "all",
  "divmod", "pow", "ord", "chr", "hex", "oct", "bin",
];

const PYTHON_MEMBERS = methodList([
  "append()", "extend()", "insert()", "remove()", "pop()", "clear()", "index()",
  "count()", "sort()", "reverse()", "copy()", "keys()", "values()", "items()",
  "get()", "update()", "setdefault()", "add()", "discard()", "union()",
  "intersection()", "join()", "split()", "rsplit()", "strip()", "lstrip()",
  "rstrip()", "upper()", "lower()", "title()", "capitalize()", "startswith()",
  "endswith()", "find()", "rfind()", "replace()", "format()", "encode()",
  "decode()", "isdigit()", "isalpha()", "read()", "readline()", "readlines()",
  "write()", "close()",
]);

const PYTHON_SNIPPETS: Completion[] = [
  snippetCompletion("def ${name}(${params}):\n\t${}", {
    label: "def", detail: "function definition", type: "function", boost: 2,
  }),
  snippetCompletion("class ${Name}:\n\tdef __init__(self${}):\n\t\t${}", {
    label: "class", detail: "class with __init__", type: "class", boost: 2,
  }),
  snippetCompletion('if __name__ == "__main__":\n\t${}', {
    label: "main", detail: 'if __name__ == "__main__"', type: "function", boost: 3,
  }),
  snippetCompletion("for ${item} in ${iterable}:\n\t${}", {
    label: "for", detail: "for loop", type: "keyword", boost: 1,
  }),
  snippetCompletion("while ${condition}:\n\t${}", {
    label: "while", detail: "while loop", type: "keyword",
  }),
  snippetCompletion("try:\n\t${}\nexcept ${Exception} as e:\n\t${}", {
    label: "try", detail: "try / except", type: "keyword",
  }),
  snippetCompletion('with open("${file}") as ${f}:\n\t${}', {
    label: "with", detail: "with open()", type: "keyword",
  }),
  snippetCompletion("lambda ${x}: ${}", {
    label: "lambda", detail: "lambda expression", type: "function",
  }),
];

// ---------------------------------------------------------------------------
// JavaScript

const JS_KEYWORDS = [
  "async", "await", "break", "case", "catch", "class", "const", "continue",
  "debugger", "default", "delete", "do", "else", "export", "extends", "finally",
  "for", "function", "if", "import", "in", "instanceof", "let", "new", "of",
  "return", "static", "super", "switch", "this", "throw", "try", "typeof", "var",
  "void", "while", "with", "yield", "true", "false", "null", "undefined",
];

const JS_SNIPPETS: Completion[] = [
  snippetCompletion("console.log(${});", {
    label: "log", detail: "console.log();", type: "function", boost: 3,
  }),
  snippetCompletion("const ${name} = (${params}) => {\n\t${}\n};", {
    label: "arrow", detail: "arrow function", type: "function", boost: 2,
  }),
  snippetCompletion("for (let ${i} = 0; ${i} < ${limit}; ${i}++) {\n\t${}\n}", {
    label: "fori", detail: "indexed for loop", type: "keyword", boost: 2,
  }),
  snippetCompletion("for (const ${item} of ${iterable}) {\n\t${}\n}", {
    label: "forof", detail: "for…of loop", type: "keyword", boost: 2,
  }),
  snippetCompletion("try {\n\t${}\n} catch (err) {\n\t${}\n}", {
    label: "try", detail: "try / catch", type: "keyword",
  }),
  snippetCompletion("async function ${name}(${params}) {\n\t${}\n}", {
    label: "asyncfn", detail: "async function", type: "function",
  }),
  snippetCompletion("JSON.stringify(${value}, null, 2)", {
    label: "jsons", detail: "JSON.stringify pretty", type: "function",
  }),
];

// ---------------------------------------------------------------------------
// Assembly

function basicSources(language: SupportedLanguage): CompletionSource[] {
  const keywords: Record<SupportedLanguage, string[]> = {
    java: JAVA_KEYWORDS,
    python: PYTHON_KEYWORDS,
    javascript: JS_KEYWORDS,
  };
  return [completeFromList(keywordList(keywords[language])), completeAnyWord];
}

function smartSources(language: SupportedLanguage): CompletionSource[] {
  switch (language) {
    case "java":
      return [
        completeFromList([...JAVA_SNIPPETS, ...typeList(JAVA_TYPES)]),
        memberSource(JAVA_MEMBERS),
        ...basicSources(language),
      ];
    case "python":
      return [
        completeFromList([
          ...PYTHON_SNIPPETS,
          ...PYTHON_BUILTINS.map((label): Completion => ({ label, type: "function", boost: 1 })),
        ]),
        memberSource(PYTHON_MEMBERS),
        ...basicSources(language),
      ];
    case "javascript":
      return [
        completeFromList([...JS_SNIPPETS, ...jsKeywordSnippets]),
        jsLocalCompletion,
        // Real scope-aware member completion (console., Math., JSON.…)
        scopeCompletionSource(globalThis),
        ...basicSources(language),
      ];
  }
}

const LANGUAGE_OF: Record<SupportedLanguage, typeof javaLanguage> = {
  java: javaLanguage,
  python: pythonLanguage,
  javascript: javascriptLanguage,
};

/**
 * Build the completion extensions for a language + mode.
 * `basicSetup.autocompletion` must be disabled — this owns the whole feature.
 */
export function completionExtensions(language: SupportedLanguage, mode: CompletionMode): Extension[] {
  if (mode === "off") return [];

  const config = { activateOnTyping: true, maxRenderedOptions: 60, icons: true };

  if (mode === "basic") {
    // `override` bypasses languageData sources, so basic stays strictly
    // keywords + document words even where the language package ships
    // smarter sources (e.g. lang-python's builtins).
    return [autocompletion({ ...config, override: basicSources(language) })];
  }

  const lang = LANGUAGE_OF[language];
  return [
    ...smartSources(language).map((source) => lang.data.of({ autocomplete: source })),
    autocompletion(config),
  ];
}
