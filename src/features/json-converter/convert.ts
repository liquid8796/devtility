/**
 * Conversion engine for the JSON ⇄ YAML ⇄ XML ⇄ TOML ⇄ CSV tool.
 * Pure functions — no React. All user-facing messages are bilingual.
 */

import { XMLBuilder, XMLParser, XMLValidator } from "fast-xml-parser";
import Papa from "papaparse";
import { parse as parseToml, stringify as stringifyToml } from "smol-toml";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";

import type { Localized } from "@/lib/i18n";

export const FORMATS = ["json", "yaml", "xml", "toml", "csv"] as const;
export type Format = (typeof FORMATS)[number];

export const FORMAT_LABELS: Record<Format, string> = {
  json: "JSON",
  yaml: "YAML",
  xml: "XML",
  toml: "TOML",
  csv: "CSV",
};

export type ConvertResult =
  | { ok: true; output: string; warnings: Localized[] }
  | { ok: false; error: Localized };

type ParseOutcome =
  | { ok: true; value: unknown; warnings: Localized[] }
  | { ok: false; error: Localized };

type SerializeOutcome =
  | { ok: true; output: string; warnings: Localized[] }
  | { ok: false; error: Localized };

// ---------------------------------------------------------------------------
// Messages
// ---------------------------------------------------------------------------

const MSG = {
  xmlWrapped: {
    vi: "Giá trị gốc không phải object một khóa — đã bọc trong thẻ <root> để tạo XML hợp lệ.",
    en: "The root value is not a single-key object — it was wrapped in a <root> element to produce valid XML.",
  },
  tomlWrappedArray: {
    vi: 'TOML cần object ở gốc — mảng đã được bọc trong khóa "items".',
    en: 'TOML requires an object at the root — the array was wrapped under an "items" key.',
  },
  tomlRootError: {
    vi: "TOML cần một object (bảng key–value) ở gốc.",
    en: "TOML requires an object (key–value table) at the root.",
  },
  csvNeedsObjects: {
    vi: "CSV cần mảng các object (mỗi phần tử là một dòng) hoặc một object đơn.",
    en: "CSV needs an array of objects (one per row) or a single object.",
  },
  csvSingleRow: {
    vi: "Đầu vào là một object đơn — đã xuất thành CSV một dòng.",
    en: "The input is a single object — exported as a one-row CSV.",
  },
  csvFlattened: {
    vi: "Giá trị lồng nhau đã được làm phẳng một cấp bằng khóa dạng chấm (a.b); cấp sâu hơn giữ dạng chuỗi JSON.",
    en: "Nested values were flattened one level using dot keys (a.b); deeper levels are kept as JSON strings.",
  },
} satisfies Record<string, Localized>;

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function tomlStrippedNote(count: number): Localized {
  return {
    vi: `Đã loại bỏ ${count} giá trị null/undefined vì TOML không hỗ trợ.`,
    en: `Removed ${count} null/undefined value(s) because TOML does not support them.`,
  };
}

// ---------------------------------------------------------------------------
// Parsing (text → JS value)
// ---------------------------------------------------------------------------

function parseJsonInput(text: string): ParseOutcome {
  try {
    return { ok: true, value: JSON.parse(text) as unknown, warnings: [] };
  } catch (error) {
    const m = errorMessage(error);
    return { ok: false, error: { vi: `JSON không hợp lệ: ${m}`, en: `Invalid JSON: ${m}` } };
  }
}

function parseYamlInput(text: string): ParseOutcome {
  try {
    return { ok: true, value: parseYaml(text) as unknown, warnings: [] };
  } catch (error) {
    const m = errorMessage(error);
    return { ok: false, error: { vi: `YAML không hợp lệ: ${m}`, en: `Invalid YAML: ${m}` } };
  }
}

function parseXmlInput(text: string): ParseOutcome {
  const verdict = XMLValidator.validate(text);
  if (verdict !== true) {
    const { msg, line, col } = verdict.err;
    return {
      ok: false,
      error: {
        vi: `XML không hợp lệ (dòng ${line}, cột ${col}): ${msg}`,
        en: `Invalid XML (line ${line}, column ${col}): ${msg}`,
      },
    };
  }
  try {
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: "@_",
      parseTagValue: true,
    });
    return { ok: true, value: parser.parse(text) as unknown, warnings: [] };
  } catch (error) {
    const m = errorMessage(error);
    return { ok: false, error: { vi: `Không đọc được XML: ${m}`, en: `Could not read XML: ${m}` } };
  }
}

function parseTomlInput(text: string): ParseOutcome {
  try {
    return { ok: true, value: parseToml(text) as unknown, warnings: [] };
  } catch (error) {
    const m = errorMessage(error);
    return { ok: false, error: { vi: `TOML không hợp lệ: ${m}`, en: `Invalid TOML: ${m}` } };
  }
}

function parseCsvInput(text: string): ParseOutcome {
  const result = Papa.parse<Record<string, unknown>>(text, {
    header: true,
    skipEmptyLines: true,
  });
  if (result.data.length === 0) {
    const detail = result.errors[0]?.message ?? "";
    return {
      ok: false,
      error: {
        vi: `CSV không có dữ liệu hợp lệ.${detail ? ` ${detail}` : ""}`,
        en: `The CSV contains no usable data.${detail ? ` ${detail}` : ""}`,
      },
    };
  }
  const warnings: Localized[] = result.errors.slice(0, 3).map((e) => {
    const row = typeof e.row === "number" ? e.row + 1 : null;
    return row === null
      ? { vi: `Lỗi CSV: ${e.message}`, en: `CSV error: ${e.message}` }
      : { vi: `Dòng ${row}: ${e.message}`, en: `Row ${row}: ${e.message}` };
  });
  return { ok: true, value: result.data, warnings };
}

function parseInput(text: string, format: Format): ParseOutcome {
  switch (format) {
    case "json":
      return parseJsonInput(text);
    case "yaml":
      return parseYamlInput(text);
    case "xml":
      return parseXmlInput(text);
    case "toml":
      return parseTomlInput(text);
    case "csv":
      return parseCsvInput(text);
  }
}

// ---------------------------------------------------------------------------
// Serialization (JS value → text)
// ---------------------------------------------------------------------------

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function serializeJson(value: unknown): SerializeOutcome {
  return { ok: true, output: JSON.stringify(value, null, 2) ?? "null", warnings: [] };
}

function serializeYaml(value: unknown): SerializeOutcome {
  try {
    return { ok: true, output: stringifyYaml(value), warnings: [] };
  } catch (error) {
    const m = errorMessage(error);
    return { ok: false, error: { vi: `Không thể tạo YAML: ${m}`, en: `Could not build YAML: ${m}` } };
  }
}

function serializeXml(value: unknown): SerializeOutcome {
  const warnings: Localized[] = [];
  let root: Record<string, unknown>;
  if (Array.isArray(value)) {
    // A bare {root: array} would repeat <root> for each item — nest under <item>.
    root = { root: { item: value } };
    warnings.push(MSG.xmlWrapped);
  } else if (!isPlainObject(value)) {
    root = { root: value };
    warnings.push(MSG.xmlWrapped);
  } else {
    const keys = Object.keys(value);
    if (keys.length !== 1 || Array.isArray(value[keys[0]])) {
      root = { root: value };
      warnings.push(MSG.xmlWrapped);
    } else {
      root = value;
    }
  }
  try {
    const builder = new XMLBuilder({
      format: true,
      ignoreAttributes: false,
      attributeNamePrefix: "@_",
    });
    const output = String(builder.build(root)).trim();
    return { ok: true, output, warnings };
  } catch (error) {
    const m = errorMessage(error);
    return { ok: false, error: { vi: `Không thể tạo XML: ${m}`, en: `Could not build XML: ${m}` } };
  }
}

/** Recursively drop null/undefined (TOML cannot represent them), counting removals. */
function stripNullish(value: unknown, counter: { removed: number }): unknown {
  if (Array.isArray(value)) {
    const kept: unknown[] = [];
    for (const item of value) {
      if (item === null || item === undefined) counter.removed += 1;
      else kept.push(stripNullish(item, counter));
    }
    return kept;
  }
  if (isPlainObject(value)) {
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) {
      if (item === null || item === undefined) counter.removed += 1;
      else out[key] = stripNullish(item, counter);
    }
    return out;
  }
  return value;
}

function serializeToml(value: unknown): SerializeOutcome {
  const warnings: Localized[] = [];
  let root: unknown = value;
  if (Array.isArray(root)) {
    root = { items: root };
    warnings.push(MSG.tomlWrappedArray);
  } else if (!isPlainObject(root)) {
    return { ok: false, error: MSG.tomlRootError };
  }
  const counter = { removed: 0 };
  const cleaned = stripNullish(root, counter);
  if (counter.removed > 0) warnings.push(tomlStrippedNote(counter.removed));
  try {
    return { ok: true, output: stringifyToml(cleaned), warnings };
  } catch (error) {
    const m = errorMessage(error);
    return { ok: false, error: { vi: `Không thể tạo TOML: ${m}`, en: `Could not build TOML: ${m}` } };
  }
}

/** Flatten each row one level: nested objects become dot keys, deeper values JSON strings. */
function flattenRows(items: ReadonlyArray<Record<string, unknown>>): {
  rows: Record<string, unknown>[];
  flattened: boolean;
} {
  let flattened = false;
  const rows = items.map((item) => {
    const row: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(item)) {
      if (isPlainObject(value)) {
        flattened = true;
        for (const [subKey, subValue] of Object.entries(value)) {
          row[`${key}.${subKey}`] =
            isPlainObject(subValue) || Array.isArray(subValue) ? JSON.stringify(subValue) : subValue;
        }
      } else if (Array.isArray(value)) {
        flattened = true;
        row[key] = JSON.stringify(value);
      } else {
        row[key] = value;
      }
    }
    return row;
  });
  return { rows, flattened };
}

function unparseRows(rows: Record<string, unknown>[]): string {
  // Collect the union of all keys so rows with extra columns lose nothing.
  const columns: string[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    for (const key of Object.keys(row)) {
      if (!seen.has(key)) {
        seen.add(key);
        columns.push(key);
      }
    }
  }
  return Papa.unparse(rows, { columns });
}

function serializeCsv(value: unknown): SerializeOutcome {
  const warnings: Localized[] = [];
  if (Array.isArray(value)) {
    if (value.length === 0 || !value.every(isPlainObject)) {
      return { ok: false, error: MSG.csvNeedsObjects };
    }
    const { rows, flattened } = flattenRows(value);
    if (flattened) warnings.push(MSG.csvFlattened);
    return { ok: true, output: unparseRows(rows), warnings };
  }
  if (isPlainObject(value)) {
    const { rows, flattened } = flattenRows([value]);
    warnings.push(MSG.csvSingleRow);
    if (flattened) warnings.push(MSG.csvFlattened);
    return { ok: true, output: unparseRows(rows), warnings };
  }
  return { ok: false, error: MSG.csvNeedsObjects };
}

function serialize(value: unknown, format: Format): SerializeOutcome {
  switch (format) {
    case "json":
      return serializeJson(value);
    case "yaml":
      return serializeYaml(value);
    case "xml":
      return serializeXml(value);
    case "toml":
      return serializeToml(value);
    case "csv":
      return serializeCsv(value);
  }
}

// ---------------------------------------------------------------------------
// Entry point + samples
// ---------------------------------------------------------------------------

export function convert(text: string, from: Format, to: Format): ConvertResult {
  const parsed = parseInput(text, from);
  if (!parsed.ok) return { ok: false, error: parsed.error };
  const serialized = serialize(parsed.value, to);
  if (!serialized.ok) return { ok: false, error: serialized.error };
  return {
    ok: true,
    output: serialized.output,
    warnings: [...parsed.warnings, ...serialized.warnings],
  };
}

export const SAMPLES: Record<Format, string> = {
  json: `{
  "server": {
    "host": "localhost",
    "port": 8080,
    "secure": true
  },
  "users": [
    { "name": "Nam Trần", "role": "admin", "city": "Hà Nội" },
    { "name": "Linh Phạm", "role": "editor", "city": "Đà Nẵng" }
  ]
}`,
  yaml: `server:
  host: localhost
  port: 8080
  secure: true
users:
  - name: Nam Trần
    role: admin
    city: Hà Nội
  - name: Linh Phạm
    role: editor
    city: Đà Nẵng`,
  xml: `<?xml version="1.0" encoding="UTF-8"?>
<library>
  <book id="1" lang="vi">
    <title>Dế Mèn Phiêu Lưu Ký</title>
    <author>Tô Hoài</author>
    <year>1941</year>
  </book>
  <book id="2" lang="en">
    <title>The Pragmatic Programmer</title>
    <author>Andrew Hunt</author>
    <year>1999</year>
  </book>
</library>`,
  toml: `title = "DevTility"

[server]
host = "localhost"
port = 8080
secure = true

[[users]]
name = "Nam Trần"
role = "admin"

[[users]]
name = "Linh Phạm"
role = "editor"`,
  csv: `name,role,city,score
Nam Trần,admin,Hà Nội,9.5
Linh Phạm,editor,Đà Nẵng,8.7
Minh Lê,viewer,TP.HCM,7.9`,
};
