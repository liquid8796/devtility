/**
 * OpenAPI 3.x / Swagger 2 parser.
 *
 * Accepts JSON or YAML text and normalizes the document into a flat view
 * model (tag groups → operations → parameters/requestBody/responses) that the
 * viewer renders. Problems surface as bilingual warnings, never hard crashes.
 */

import { parse as parseYaml } from "yaml";

import type { Localized } from "@/lib/i18n";

// ---------------------------------------------------------------------------
// View model
// ---------------------------------------------------------------------------

export type HttpMethod = "get" | "post" | "put" | "patch" | "delete" | "head" | "options";

export const FILTERABLE_METHODS = ["get", "post", "put", "patch", "delete"] as const;

export interface ParamView {
  name: string;
  /** path / query / header / cookie / formData */
  location: string;
  type: string;
  required: boolean;
  description?: string;
  schema?: unknown;
}

export interface ResponseView {
  status: string;
  description: string;
  contentType?: string;
  schema?: unknown;
  example?: unknown;
}

export interface RequestBodyView {
  contentType: string;
  schema?: unknown;
  example?: unknown;
  required: boolean;
}

export interface OperationView {
  /** Unique key, `${method} ${path}`. */
  key: string;
  method: HttpMethod;
  path: string;
  summary?: string;
  description?: string;
  operationId?: string;
  parameters: ParamView[];
  requestBody?: RequestBodyView;
  responses: ResponseView[];
}

export interface TagGroup {
  name: string;
  description?: string;
  operations: OperationView[];
}

export interface SecurityView {
  kind: "bearer" | "apiKeyHeader" | "apiKeyQuery" | "basic" | "other";
  name: string;
  headerName?: string;
  paramName?: string;
}

export interface SpecView {
  /** Raw parsed document — needed to resolve $refs lazily. */
  raw: Record<string, unknown>;
  specVersion: string;
  title: string;
  version: string;
  description?: string;
  servers: string[];
  tags: TagGroup[];
  operationCount: number;
  security: SecurityView[];
  warnings: Localized[];
}

export interface SpecOutcome {
  view: SpecView | null;
  error: Localized | null;
}

// ---------------------------------------------------------------------------
// Guards
// ---------------------------------------------------------------------------

type Obj = Record<string, unknown>;

function isObj(v: unknown): v is Obj {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function asStr(v: unknown): string | undefined {
  return typeof v === "string" ? v : undefined;
}

function asObjArr(v: unknown): Obj[] {
  return Array.isArray(v) ? v.filter(isObj) : [];
}

// ---------------------------------------------------------------------------
// $ref resolution
// ---------------------------------------------------------------------------

/**
 * Resolve a local JSON pointer like `#/components/schemas/Pet` or
 * `#/definitions/Pet` against the raw document. Returns undefined for
 * external or malformed refs.
 */
export function resolveRef(doc: Obj, ref: string): unknown {
  if (!ref.startsWith("#/")) return undefined;
  const segments = ref
    .slice(2)
    .split("/")
    .map((s) => s.replace(/~1/g, "/").replace(/~0/g, "~"));
  let node: unknown = doc;
  for (const segment of segments) {
    if (!isObj(node)) return undefined;
    node = node[segment];
  }
  return node;
}

/** Follow a possible `$ref` one hop (with a small loop guard). */
function deref(doc: Obj, node: unknown): unknown {
  let current = node;
  for (let hops = 0; hops < 8; hops++) {
    if (!isObj(current)) return current;
    const ref = asStr(current.$ref);
    if (!ref) return current;
    const next = resolveRef(doc, ref);
    if (next === undefined || next === current) return current;
    current = next;
  }
  return current;
}

/** Short human label for a schema (used in the parameters table). */
export function schemaTypeLabel(doc: Obj, schema: unknown): string {
  if (!isObj(schema)) return "—";
  const ref = asStr(schema.$ref);
  if (ref) return ref.split("/").pop() ?? "object";
  const type = Array.isArray(schema.type)
    ? asStr(schema.type.find((t) => t !== "null")) ?? "object"
    : asStr(schema.type);
  if (type === "array") {
    const items = isObj(schema.items) ? schema.items : undefined;
    return `array<${items ? schemaTypeLabel(doc, items) : "any"}>`;
  }
  const format = asStr(schema.format);
  if (Array.isArray(schema.enum) && schema.enum.length > 0) return `enum`;
  if (!type) return isObj(schema.properties) ? "object" : "any";
  return format ? `${type} (${format})` : type;
}

// ---------------------------------------------------------------------------
// Normalization
// ---------------------------------------------------------------------------

const METHODS: HttpMethod[] = ["get", "post", "put", "patch", "delete", "head", "options"];

const PREFERRED_CONTENT_TYPES = ["application/json", "application/x-www-form-urlencoded", "multipart/form-data"];

function pickContent(content: Obj): { contentType: string; media: Obj } | null {
  const keys = Object.keys(content);
  if (keys.length === 0) return null;
  const preferred =
    keys.find((k) => k.toLowerCase().includes("json")) ??
    keys.find((k) => PREFERRED_CONTENT_TYPES.includes(k.toLowerCase())) ??
    keys[0];
  const media = content[preferred];
  return { contentType: preferred, media: isObj(media) ? media : {} };
}

function normalizeParam(doc: Obj, rawParam: Obj, isSwagger2: boolean): ParamView | { body: Obj } | null {
  const param = deref(doc, rawParam);
  if (!isObj(param)) return null;

  const name = asStr(param.name) ?? "";
  const location = asStr(param.in) ?? "query";

  if (isSwagger2 && location === "body") {
    return { body: param };
  }

  let schema: unknown;
  let type: string;
  if (isSwagger2) {
    schema = param; // Swagger 2 inlines type/format/enum on the parameter itself
    const t = asStr(param.type) ?? "string";
    const format = asStr(param.format);
    type = format ? `${t} (${format})` : Array.isArray(param.enum) && param.enum.length > 0 ? "enum" : t;
  } else {
    schema = param.schema;
    type = schemaTypeLabel(doc, param.schema);
  }

  return {
    name,
    location,
    type,
    required: param.required === true || location === "path",
    description: asStr(param.description),
    schema,
  };
}

function normalizeResponses(doc: Obj, responses: unknown, isSwagger2: boolean): ResponseView[] {
  if (!isObj(responses)) return [];
  const result: ResponseView[] = [];
  for (const status of Object.keys(responses)) {
    if (status.startsWith("x-")) continue;
    const raw = deref(doc, responses[status]);
    if (!isObj(raw)) continue;
    const view: ResponseView = {
      status,
      description: asStr(raw.description) ?? "",
    };
    if (isSwagger2) {
      if (raw.schema !== undefined) {
        view.schema = raw.schema;
        view.contentType = "application/json";
      }
      if (isObj(raw.examples)) {
        const first = Object.values(raw.examples)[0];
        if (first !== undefined) view.example = first;
      }
    } else if (isObj(raw.content)) {
      const picked = pickContent(raw.content);
      if (picked) {
        view.contentType = picked.contentType;
        view.schema = picked.media.schema;
        if (picked.media.example !== undefined) view.example = picked.media.example;
        else if (isObj(picked.media.examples)) {
          const first = Object.values(picked.media.examples)[0];
          if (isObj(first) && first.value !== undefined) view.example = first.value;
        }
      }
    }
    result.push(view);
  }
  return result.sort((a, b) => a.status.localeCompare(b.status));
}

function normalizeSecurity(doc: Obj, isSwagger2: boolean): SecurityView[] {
  const container = isSwagger2
    ? doc.securityDefinitions
    : isObj(doc.components)
      ? doc.components.securitySchemes
      : undefined;
  if (!isObj(container)) return [];

  const result: SecurityView[] = [];
  for (const name of Object.keys(container)) {
    const scheme = deref(doc, container[name]);
    if (!isObj(scheme)) continue;
    const type = asStr(scheme.type)?.toLowerCase();
    if (type === "http") {
      const httpScheme = asStr(scheme.scheme)?.toLowerCase();
      result.push({ kind: httpScheme === "basic" ? "basic" : httpScheme === "bearer" ? "bearer" : "other", name });
    } else if (type === "basic") {
      result.push({ kind: "basic", name });
    } else if (type === "apikey") {
      const where = asStr(scheme.in)?.toLowerCase();
      if (where === "header") {
        result.push({ kind: "apiKeyHeader", name, headerName: asStr(scheme.name) ?? "X-API-Key" });
      } else if (where === "query") {
        result.push({ kind: "apiKeyQuery", name, paramName: asStr(scheme.name) ?? "api_key" });
      } else {
        result.push({ kind: "other", name });
      }
    } else if (type === "oauth2" || type === "openidconnect") {
      result.push({ kind: "bearer", name });
    } else {
      result.push({ kind: "other", name });
    }
  }
  return result;
}

function buildServers(doc: Obj, isSwagger2: boolean, warnings: Localized[]): string[] {
  if (isSwagger2) {
    const host = asStr(doc.host);
    const basePath = asStr(doc.basePath) ?? "";
    const schemes = Array.isArray(doc.schemes) ? doc.schemes.filter((s): s is string => typeof s === "string") : [];
    if (!host) {
      if (basePath) return [basePath];
      return [];
    }
    const useSchemes = schemes.length > 0 ? schemes : ["https"];
    return useSchemes.map((scheme) => `${scheme}://${host}${basePath}`);
  }

  const servers = asObjArr(doc.servers);
  const urls: string[] = [];
  for (const server of servers) {
    let url = asStr(server.url) ?? "";
    if (!url) continue;
    // Substitute server variables with their defaults where available.
    if (isObj(server.variables)) {
      for (const varName of Object.keys(server.variables)) {
        const variable = server.variables[varName];
        const def = isObj(variable) ? asStr(variable.default) ?? String(variable.default ?? "") : "";
        if (def) url = url.split(`{${varName}}`).join(def);
      }
    }
    if (url.includes("{")) {
      warnings.push({
        vi: `Server "${url}" còn biến chưa có giá trị mặc định.`,
        en: `Server "${url}" still contains variables without defaults.`,
      });
    }
    urls.push(url);
  }
  return urls;
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

export function parseSpec(text: string): SpecOutcome {
  const trimmed = text.trim();
  if (!trimmed) return { view: null, error: null };

  let doc: unknown;
  try {
    doc = JSON.parse(trimmed);
  } catch {
    try {
      doc = parseYaml(trimmed, { maxAliasCount: 1000 });
    } catch (yamlError) {
      const detail = yamlError instanceof Error ? yamlError.message.split("\n")[0].slice(0, 140) : "";
      return {
        view: null,
        error: {
          vi: `Không đọc được spec — không phải JSON hay YAML hợp lệ. ${detail}`,
          en: `Could not read the spec — it is neither valid JSON nor valid YAML. ${detail}`,
        },
      };
    }
  }

  if (!isObj(doc)) {
    return {
      view: null,
      error: {
        vi: "Spec phải là một object JSON/YAML (bắt đầu bằng openapi/swagger + paths).",
        en: "The spec must be a JSON/YAML object (starting with openapi/swagger + paths).",
      },
    };
  }

  const openapi = asStr(doc.openapi);
  const swagger = asStr(doc.swagger);
  if (!openapi && !swagger && !isObj(doc.paths)) {
    return {
      view: null,
      error: {
        vi: 'Không tìm thấy trường "openapi", "swagger" hay "paths" — đây không phải OpenAPI spec.',
        en: 'No "openapi", "swagger" or "paths" field found — this is not an OpenAPI spec.',
      },
    };
  }

  const isSwagger2 = swagger !== undefined && swagger.startsWith("2");
  const warnings: Localized[] = [];

  const info = isObj(doc.info) ? doc.info : {};
  const specVersion = isSwagger2 ? `Swagger ${swagger}` : `OpenAPI ${openapi ?? "3.x"}`;

  // Tag descriptions + declaration order.
  const tagOrder: string[] = [];
  const tagDescriptions = new Map<string, string>();
  for (const tag of asObjArr(doc.tags)) {
    const name = asStr(tag.name);
    if (!name) continue;
    tagOrder.push(name);
    const description = asStr(tag.description);
    if (description) tagDescriptions.set(name, description);
  }

  // Walk paths.
  const groups = new Map<string, OperationView[]>();
  let operationCount = 0;

  const paths = isObj(doc.paths) ? doc.paths : {};
  for (const path of Object.keys(paths)) {
    if (path.startsWith("x-")) continue;
    const rawItem = paths[path];
    const pathItem = deref(doc, rawItem);
    if (!isObj(pathItem)) continue;

    const pathLevelParams = asObjArr(pathItem.parameters);

    for (const method of METHODS) {
      const rawOp = pathItem[method];
      if (!isObj(rawOp)) continue;
      operationCount++;

      // Merge path-level parameters with operation parameters (op wins on name+in).
      const opParams = asObjArr(rawOp.parameters);
      const mergedRaw: Obj[] = [...opParams];
      for (const pathParam of pathLevelParams) {
        const resolved = deref(doc, pathParam);
        if (!isObj(resolved)) continue;
        const dup = opParams.some((p) => {
          const r = deref(doc, p);
          return isObj(r) && r.name === resolved.name && r.in === resolved.in;
        });
        if (!dup) mergedRaw.push(pathParam);
      }

      const parameters: ParamView[] = [];
      let requestBody: RequestBodyView | undefined;

      for (const rawParam of mergedRaw) {
        const normalized = normalizeParam(doc, rawParam, isSwagger2);
        if (!normalized) continue;
        if ("body" in normalized) {
          // Swagger 2 body parameter → requestBody
          const consumes = Array.isArray(rawOp.consumes)
            ? rawOp.consumes.filter((c): c is string => typeof c === "string")
            : Array.isArray(doc.consumes)
              ? doc.consumes.filter((c): c is string => typeof c === "string")
              : [];
          requestBody = {
            contentType: consumes[0] ?? "application/json",
            schema: normalized.body.schema,
            required: normalized.body.required === true,
          };
          continue;
        }
        parameters.push(normalized);
      }

      // OpenAPI 3 requestBody
      if (!isSwagger2 && rawOp.requestBody !== undefined) {
        const body = deref(doc, rawOp.requestBody);
        if (isObj(body) && isObj(body.content)) {
          const picked = pickContent(body.content);
          if (picked) {
            let example: unknown;
            if (picked.media.example !== undefined) example = picked.media.example;
            else if (isObj(picked.media.examples)) {
              const first = Object.values(picked.media.examples)[0];
              if (isObj(first) && first.value !== undefined) example = first.value;
            }
            requestBody = {
              contentType: picked.contentType,
              schema: picked.media.schema,
              example,
              required: body.required === true,
            };
          }
        }
      }

      const opTags = Array.isArray(rawOp.tags)
        ? rawOp.tags.filter((tag): tag is string => typeof tag === "string")
        : [];
      const groupName = opTags[0] ?? "default";

      const operation: OperationView = {
        key: `${method} ${path}`,
        method,
        path,
        summary: asStr(rawOp.summary),
        description: asStr(rawOp.description),
        operationId: asStr(rawOp.operationId),
        parameters,
        requestBody,
        responses: normalizeResponses(doc, rawOp.responses, isSwagger2),
      };

      const bucket = groups.get(groupName);
      if (bucket) bucket.push(operation);
      else groups.set(groupName, [operation]);
    }
  }

  // Order tags: spec declaration order first, then the rest alphabetically.
  const remaining = Array.from(groups.keys())
    .filter((name) => !tagOrder.includes(name))
    .sort((a, b) => a.localeCompare(b));
  const orderedNames = [...tagOrder.filter((name) => groups.has(name)), ...remaining];

  const tags: TagGroup[] = orderedNames.map((name) => ({
    name,
    description: tagDescriptions.get(name),
    operations: groups.get(name) ?? [],
  }));

  if (operationCount === 0) {
    warnings.push({
      vi: "Spec không có endpoint nào trong paths.",
      en: "The spec has no endpoints under paths.",
    });
  }

  return {
    view: {
      raw: doc,
      specVersion,
      title: asStr(info.title) ?? "(untitled API)",
      version: asStr(info.version) ?? "—",
      description: asStr(info.description),
      servers: buildServers(doc, isSwagger2, warnings),
      tags,
      operationCount,
      security: normalizeSecurity(doc, isSwagger2),
      warnings,
    },
    error: null,
  };
}
