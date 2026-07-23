/**
 * JSON-schema → example generator + sample cURL/fetch request builders.
 *
 * Example generation honors example/default/enum[0], is format-aware for
 * strings, resolves local $refs (`#/components/schemas/X`, `#/definitions/X`)
 * with a depth cap of 6 and a cycle guard.
 */

import { resolveRef, type OperationView, type SecurityView, type SpecView } from "./parse-spec";

type Obj = Record<string, unknown>;

function isObj(v: unknown): v is Obj {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

const MAX_DEPTH = 6;

const STRING_FORMAT_EXAMPLES: Record<string, string> = {
  uuid: "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "date-time": "2026-01-01T09:30:00Z",
  date: "2026-01-01",
  time: "09:30:00Z",
  email: "user@example.com",
  uri: "https://example.com",
  url: "https://example.com",
  hostname: "example.com",
  ipv4: "192.168.1.1",
  ipv6: "2001:db8::1",
  byte: "ZGV2dGlsaXR5",
  binary: "<binary data>",
  password: "********",
};

/**
 * Generate an example value from a JSON schema.
 *
 * @param doc  raw spec document ($ref resolution root)
 * @param schema  the (possibly $ref) schema node
 */
export function exampleFromSchema(
  doc: Obj,
  schema: unknown,
  depth = 0,
  seen: ReadonlySet<string> = new Set(),
): unknown {
  if (depth > MAX_DEPTH) return "…";
  if (!isObj(schema)) return null;

  // $ref → resolve with cycle guard
  const ref = typeof schema.$ref === "string" ? schema.$ref : undefined;
  if (ref) {
    if (seen.has(ref)) return "…"; // circular reference
    const resolved = resolveRef(doc, ref);
    if (resolved === undefined) return null;
    const nextSeen = new Set(seen);
    nextSeen.add(ref);
    return exampleFromSchema(doc, resolved, depth + 1, nextSeen);
  }

  // Explicit values take precedence.
  if (schema.example !== undefined) return schema.example;
  if (schema.default !== undefined) return schema.default;
  if (Array.isArray(schema.enum) && schema.enum.length > 0) return schema.enum[0];
  if (schema.const !== undefined) return schema.const;

  // Composition keywords.
  if (Array.isArray(schema.allOf) && schema.allOf.length > 0) {
    const merged: Obj = {};
    let scalar: unknown;
    for (const part of schema.allOf) {
      const value = exampleFromSchema(doc, part, depth + 1, seen);
      if (isObj(value)) Object.assign(merged, value);
      else if (value !== null && scalar === undefined) scalar = value;
    }
    return Object.keys(merged).length > 0 ? merged : (scalar ?? {});
  }
  if (Array.isArray(schema.oneOf) && schema.oneOf.length > 0) {
    return exampleFromSchema(doc, schema.oneOf[0], depth + 1, seen);
  }
  if (Array.isArray(schema.anyOf) && schema.anyOf.length > 0) {
    return exampleFromSchema(doc, schema.anyOf[0], depth + 1, seen);
  }

  // OAS 3.1: type may be an array — use the first non-null entry.
  const rawType = schema.type;
  const type = Array.isArray(rawType) ? rawType.find((t) => t !== "null") : rawType;

  switch (type) {
    case "string": {
      const format = typeof schema.format === "string" ? schema.format : "";
      return STRING_FORMAT_EXAMPLES[format] ?? "string";
    }
    case "integer":
    case "number": {
      if (typeof schema.minimum === "number") return schema.minimum;
      return 0;
    }
    case "boolean":
      return true;
    case "array": {
      if (schema.items === undefined) return [];
      return [exampleFromSchema(doc, schema.items, depth + 1, seen)];
    }
    case "object":
      return objectExample(doc, schema, depth, seen);
    default:
      // No type declared — infer from structure.
      if (isObj(schema.properties)) return objectExample(doc, schema, depth, seen);
      if (schema.items !== undefined) return [exampleFromSchema(doc, schema.items, depth + 1, seen)];
      return {};
  }
}

function objectExample(doc: Obj, schema: Obj, depth: number, seen: ReadonlySet<string>): unknown {
  const result: Obj = {};
  if (isObj(schema.properties)) {
    for (const key of Object.keys(schema.properties)) {
      result[key] = exampleFromSchema(doc, schema.properties[key], depth + 1, seen);
    }
  } else if (isObj(schema.additionalProperties)) {
    result.key = exampleFromSchema(doc, schema.additionalProperties, depth + 1, seen);
  }
  return result;
}

// ---------------------------------------------------------------------------
// Sample request builders (cURL + fetch) for a selected operation
// ---------------------------------------------------------------------------

export interface SampleRequest {
  curl: string;
  fetch: string;
}

function shellDq(s: string): string {
  return `"${s.replace(/([\\"$`])/g, "\\$1")}"`;
}

function shellSq(s: string): string {
  return `'${s.replace(/'/g, "'\\''")}'`;
}

function jsQuote(s: string): string {
  return `"${s.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n")}"`;
}

function paramPlaceholder(doc: Obj, schema: unknown): string {
  const value = exampleFromSchema(doc, schema);
  if (value === null || value === undefined || isObj(value) || Array.isArray(value)) return "value";
  return String(value);
}

function securityHeader(security: SecurityView[]): [string, string] | null {
  const bearer = security.find((s) => s.kind === "bearer");
  if (bearer) return ["Authorization", "Bearer <token>"];
  const apiKey = security.find((s) => s.kind === "apiKeyHeader");
  if (apiKey) return [apiKey.headerName ?? "X-API-Key", "<api-key>"];
  const basic = security.find((s) => s.kind === "basic");
  if (basic) return ["Authorization", "Basic <credentials>"];
  return null;
}

/** Build the full request URL (path params kept as {id} placeholders). */
function buildUrl(view: SpecView, op: OperationView): string {
  const server = view.servers[0] ?? "";
  const base = server.endsWith("/") ? server.slice(0, -1) : server;
  let url = `${base}${op.path.startsWith("/") ? "" : "/"}${op.path}`;

  const query: string[] = [];
  for (const param of op.parameters) {
    if (param.location === "query" && param.required) {
      query.push(`${encodeURIComponent(param.name)}=${encodeURIComponent(paramPlaceholder(view.raw, param.schema))}`);
    }
  }
  const apiKeyQuery = view.security.find((s) => s.kind === "apiKeyQuery");
  if (apiKeyQuery) query.push(`${encodeURIComponent(apiKeyQuery.paramName ?? "api_key")}=<api-key>`);
  if (query.length > 0) url += `${url.includes("?") ? "&" : "?"}${query.join("&")}`;
  return url;
}

export function buildSampleRequest(view: SpecView, op: OperationView): SampleRequest {
  const url = buildUrl(view, op);
  const method = op.method.toUpperCase();

  const headers: Array<[string, string]> = [];
  const auth = securityHeader(view.security);
  if (auth) headers.push(auth);
  for (const param of op.parameters) {
    if (param.location === "header" && param.required) {
      headers.push([param.name, paramPlaceholder(view.raw, param.schema)]);
    }
  }

  let bodyJson: string | null = null;
  if (op.requestBody) {
    headers.push(["Content-Type", op.requestBody.contentType]);
    const example =
      op.requestBody.example !== undefined
        ? op.requestBody.example
        : op.requestBody.schema !== undefined
          ? exampleFromSchema(view.raw, op.requestBody.schema)
          : undefined;
    if (example !== undefined) {
      bodyJson = op.requestBody.contentType.includes("json")
        ? JSON.stringify(example, null, 2)
        : typeof example === "string"
          ? example
          : JSON.stringify(example);
    }
  }

  // ---- cURL ----
  const curlParts: string[] = [];
  curlParts.push(method === "GET" ? `curl ${shellDq(url)}` : `curl -X ${method} ${shellDq(url)}`);
  for (const [k, v] of headers) curlParts.push(`-H ${shellDq(`${k}: ${v}`)}`);
  if (bodyJson !== null) curlParts.push(`--data-raw ${shellSq(bodyJson)}`);
  const curl = curlParts.join(" \\\n  ");

  // ---- fetch ----
  const lines: string[] = [];
  lines.push(`const response = await fetch(${jsQuote(url)}, {`);
  lines.push(`  method: ${jsQuote(method)},`);
  if (headers.length > 0) {
    lines.push("  headers: {");
    for (const [k, v] of headers) lines.push(`    ${jsQuote(k)}: ${jsQuote(v)},`);
    lines.push("  },");
  }
  if (bodyJson !== null) {
    const indented = bodyJson
      .split("\n")
      .map((line, idx) => (idx === 0 ? line : `  ${line}`))
      .join("\n");
    lines.push(`  body: JSON.stringify(${indented}),`);
  }
  lines.push("});");
  lines.push("");
  lines.push("if (!response.ok) {");
  lines.push("  throw new Error(`HTTP ${response.status}`);");
  lines.push("}");
  lines.push("const data = await response.json();");
  lines.push("console.log(data);");
  const fetchCode = lines.join("\n");

  return { curl, fetch: fetchCode };
}
