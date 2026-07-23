/**
 * cURL / grpcurl command parser.
 *
 * Tokenizes a shell command (POSIX quoting rules + Windows `^` continuations)
 * and normalizes it into a {@link RequestModel} that the generators consume.
 * Unknown constructs never fail the parse — they surface as bilingual warnings.
 */

import type { Localized } from "@/lib/i18n";

// ---------------------------------------------------------------------------
// Model
// ---------------------------------------------------------------------------

export type BodyType = "raw" | "json" | "form-urlencoded" | "multipart";

export interface RequestBody {
  type: BodyType;
  /** Raw body text (for multipart this is a `k=v` per-line rendering). */
  raw?: string;
  /** Decoded pairs for form-urlencoded / multipart bodies. */
  params?: Array<[string, string]>;
}

export interface GrpcInfo {
  address: string;
  /** Fully-qualified method, e.g. `shop.v1.OrderService/GetOrder`. */
  method: string;
  /** JSON request payload from `-d`. */
  data: string;
  metadata: Array<[string, string]>;
  plaintext: boolean;
}

export interface RequestModel {
  kind: "http" | "grpc";
  method: string;
  url: string;
  headers: Array<[string, string]>;
  body?: RequestBody;
  auth?: { user: string; pass: string };
  cookies?: string;
  flags: { location: boolean; compressed: boolean; insecure: boolean };
  grpc?: GrpcInfo;
  warnings: Localized[];
}

export interface ParseOutcome {
  model: RequestModel | null;
  error: Localized | null;
}

// ---------------------------------------------------------------------------
// Tokenizer — shell-style word splitting
// ---------------------------------------------------------------------------

const ANSI_C_ESCAPES: Record<string, string> = {
  n: "\n",
  t: "\t",
  r: "\r",
  "\\": "\\",
  "'": "'",
  '"': '"',
  "0": "\0",
  a: "\x07",
  b: "\b",
  f: "\f",
  v: "\v",
  e: "\x1b",
};

function isNewlineAt(src: string, i: number): number {
  if (src[i] === "\n") return 1;
  if (src[i] === "\r" && src[i + 1] === "\n") return 2;
  if (src[i] === "\r") return 1;
  return 0;
}

/**
 * Split a command line into shell words. Handles `\` + newline (POSIX) and
 * `^` + newline (cmd.exe) continuations, single/double quotes, `$'…'`
 * ANSI-C strings and backslash escapes in unquoted context.
 */
export function tokenize(command: string): string[] {
  const src = command;
  const n = src.length;
  const tokens: string[] = [];
  let current = "";
  let hasToken = false;
  let i = 0;

  const flush = () => {
    if (hasToken) {
      tokens.push(current);
      current = "";
      hasToken = false;
    }
  };

  while (i < n) {
    const ch = src[i];

    // Line continuations in unquoted context.
    if (ch === "\\" || ch === "^") {
      const nl = isNewlineAt(src, i + 1);
      if (nl > 0) {
        i += 1 + nl;
        continue;
      }
    }

    if (ch === " " || ch === "\t" || ch === "\n" || ch === "\r") {
      flush();
      i++;
      continue;
    }

    // ANSI-C quoted string: $'…'
    if (ch === "$" && src[i + 1] === "'") {
      hasToken = true;
      i += 2;
      while (i < n && src[i] !== "'") {
        if (src[i] === "\\" && i + 1 < n) {
          const esc = src[i + 1];
          const mapped = ANSI_C_ESCAPES[esc];
          if (mapped !== undefined) {
            current += mapped;
            i += 2;
            continue;
          }
          if (esc === "x" || esc === "u") {
            const width = esc === "x" ? 2 : 4;
            const hex = src.slice(i + 2, i + 2 + width).match(/^[0-9a-fA-F]+/)?.[0] ?? "";
            if (hex) {
              current += String.fromCharCode(parseInt(hex, 16));
              i += 2 + hex.length;
              continue;
            }
          }
          current += esc;
          i += 2;
          continue;
        }
        current += src[i];
        i++;
      }
      i++; // closing quote
      continue;
    }

    if (ch === "'") {
      hasToken = true;
      i++;
      while (i < n && src[i] !== "'") {
        current += src[i];
        i++;
      }
      i++;
      continue;
    }

    if (ch === '"') {
      hasToken = true;
      i++;
      while (i < n && src[i] !== '"') {
        if (src[i] === "\\" && i + 1 < n) {
          const esc = src[i + 1];
          const nl = isNewlineAt(src, i + 1);
          if (nl > 0) {
            // Backslash-newline inside double quotes is a continuation.
            i += 1 + nl;
            continue;
          }
          if (esc === '"' || esc === "\\" || esc === "$" || esc === "`") {
            current += esc;
            i += 2;
            continue;
          }
          current += "\\";
          i++;
          continue;
        }
        current += src[i];
        i++;
      }
      i++;
      continue;
    }

    if (ch === "\\") {
      hasToken = true;
      if (i + 1 < n) {
        current += src[i + 1];
        i += 2;
      } else {
        i++;
      }
      continue;
    }

    hasToken = true;
    current += ch;
    i++;
  }

  flush();
  return tokens;
}

// ---------------------------------------------------------------------------
// Warning helpers (bilingual)
// ---------------------------------------------------------------------------

function pushWarning(list: Localized[], vi: string, en: string): void {
  if (!list.some((w) => w.vi === vi)) list.push({ vi, en });
}

function warnUnknownFlag(list: Localized[], flag: string): void {
  pushWarning(list, `Bỏ qua cờ không hỗ trợ "${flag}".`, `Ignored unsupported flag "${flag}".`);
}

function warnIgnoredWithValue(list: Localized[], flag: string): void {
  pushWarning(
    list,
    `Cờ "${flag}" không áp dụng được khi chuyển đổi — đã bỏ qua.`,
    `Flag "${flag}" does not apply to the conversion — ignored.`,
  );
}

function warnMissingValue(list: Localized[], flag: string): void {
  pushWarning(list, `Cờ "${flag}" thiếu giá trị.`, `Flag "${flag}" is missing its value.`);
}

function warnFileRef(list: Localized[], ref: string): void {
  pushWarning(
    list,
    `Không đọc được tệp "${ref}" trong trình duyệt — hãy thay bằng nội dung thật.`,
    `File "${ref}" cannot be read in the browser — replace it with the actual content.`,
  );
}

function warnTimeout(list: Localized[], flag: string): void {
  pushWarning(list, `"${flag}": timeout không được chuyển.`, `"${flag}": timeout not converted.`);
}

// ---------------------------------------------------------------------------
// Small utils
// ---------------------------------------------------------------------------

/** UTF-8-safe Base64 (btoa alone throws on non-Latin1 input). */
function base64Utf8(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  try {
    return btoa(binary);
  } catch {
    return "";
  }
}

function looksLikeJson(raw: string): boolean {
  const trimmed = raw.trim();
  if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) return false;
  try {
    JSON.parse(trimmed);
    return true;
  } catch {
    return false;
  }
}

function tryDecodeURIComponent(value: string): string {
  try {
    return decodeURIComponent(value.replace(/\+/g, " "));
  } catch {
    return value;
  }
}

function findHeader(headers: Array<[string, string]>, name: string): [string, string] | undefined {
  const lower = name.toLowerCase();
  return headers.find(([k]) => k.toLowerCase() === lower);
}

function setHeader(headers: Array<[string, string]>, name: string, value: string): void {
  const existing = findHeader(headers, name);
  if (existing) existing[1] = value;
  else headers.push([name, value]);
}

// ---------------------------------------------------------------------------
// curl parser
// ---------------------------------------------------------------------------

/** Long flags whose value we consume but cannot convert (warn once). */
const CONSUMED_UNSUPPORTED_LONG = new Set([
  "--retry",
  "--retry-delay",
  "--retry-max-time",
  "--cacert",
  "--capath",
  "--cert",
  "--key",
  "--cert-type",
  "--key-type",
  "--proxy",
  "--proxy-user",
  "--resolve",
  "--limit-rate",
  "--interface",
  "--ciphers",
  "--dns-servers",
  "--keepalive-time",
  "--trace",
  "--trace-ascii",
  "--write-out",
  "--config",
  "--upload-file",
  "--range",
  "--speed-limit",
  "--speed-time",
  "--unix-socket",
  "--pass",
]);

/** Boolean flags that are irrelevant to conversion — ignored silently. */
const SILENT_BOOLEAN_LONG = new Set([
  "--silent",
  "--show-error",
  "--verbose",
  "--include",
  "--fail",
  "--fail-with-body",
  "--globoff",
  "--progress-bar",
  "--no-progress-meter",
  "--http1.1",
  "--http2",
  "--http2-prior-knowledge",
  "--http3",
  "--tlsv1.2",
  "--tlsv1.3",
  "--ssl-no-revoke",
  "--disable",
  "--no-buffer",
  "--basic",
  "--remote-name",
  "--remote-header-name",
]);

function parseCurlTokens(tokens: string[]): RequestModel {
  const warnings: Localized[] = [];
  const headers: Array<[string, string]> = [];
  const dataParts: string[] = [];
  const formParams: Array<[string, string]> = [];
  const positionals: string[] = [];
  const flags = { location: false, compressed: false, insecure: false };

  let explicitMethod: string | null = null;
  let urlFlag: string | null = null;
  let auth: { user: string; pass: string } | undefined;
  let cookies: string | undefined;
  let jsonMode = false;
  let getMode = false;
  let headMode = false;

  let i = 0;

  const nextValue = (flag: string): string | null => {
    if (i + 1 < tokens.length) {
      i++;
      return tokens[i];
    }
    warnMissingValue(warnings, flag);
    return null;
  };

  const addHeaderLine = (line: string) => {
    const idx = line.indexOf(":");
    if (idx === -1) {
      if (line.endsWith(";")) {
        headers.push([line.slice(0, -1).trim(), ""]);
        return;
      }
      pushWarning(
        warnings,
        `Header không hợp lệ: "${line}" (thiếu dấu ":").`,
        `Invalid header: "${line}" (missing ":").`,
      );
      return;
    }
    const name = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim();
    if (!name) {
      pushWarning(warnings, `Header không hợp lệ: "${line}".`, `Invalid header: "${line}".`);
      return;
    }
    headers.push([name, value]);
  };

  const pushData = (value: string, interpretAt: boolean) => {
    if (interpretAt && value.startsWith("@")) {
      warnFileRef(warnings, value);
      return;
    }
    dataParts.push(value);
  };

  const pushDataUrlencode = (value: string) => {
    if (value.startsWith("@")) {
      warnFileRef(warnings, value);
      return;
    }
    const eq = value.indexOf("=");
    const at = value.indexOf("@");
    if (eq === -1 && at === -1) {
      dataParts.push(encodeURIComponent(value));
    } else if (eq !== -1 && (at === -1 || eq < at)) {
      const name = value.slice(0, eq);
      dataParts.push((name ? `${name}=` : "") + encodeURIComponent(value.slice(eq + 1)));
    } else {
      // name@filename
      warnFileRef(warnings, value.slice(at));
    }
  };

  const pushForm = (value: string, interpretFiles: boolean) => {
    const eq = value.indexOf("=");
    if (eq === -1) {
      pushWarning(
        warnings,
        `Trường -F không hợp lệ: "${value}" (thiếu dấu "=").`,
        `Invalid -F field: "${value}" (missing "=").`,
      );
      return;
    }
    const name = value.slice(0, eq);
    const val = value.slice(eq + 1);
    if (interpretFiles && (val.startsWith("@") || val.startsWith("<"))) {
      warnFileRef(warnings, val);
    }
    formParams.push([name, val]);
  };

  const setUser = (value: string) => {
    const idx = value.indexOf(":");
    if (idx === -1) {
      auth = { user: value, pass: "" };
      pushWarning(
        warnings,
        `-u không kèm mật khẩu (thiếu ":") — dùng mật khẩu rỗng.`,
        `-u has no password (missing ":") — using an empty password.`,
      );
    } else {
      auth = { user: value.slice(0, idx), pass: value.slice(idx + 1) };
    }
  };

  const setCookie = (value: string) => {
    if (value.includes("=")) {
      cookies = cookies ? `${cookies}; ${value}` : value;
    } else {
      pushWarning(
        warnings,
        `Giá trị -b "${value}" là tệp cookie — không khả dụng trong trình duyệt.`,
        `-b value "${value}" is a cookie file — not available in the browser.`,
      );
    }
  };

  for (; i < tokens.length; i++) {
    const token = tokens[i];

    if (token.startsWith("--")) {
      const eq = token.indexOf("=");
      const flag = eq === -1 ? token : token.slice(0, eq);
      const inline = eq === -1 ? null : token.slice(eq + 1);
      const value = (): string | null => inline ?? nextValue(flag);

      switch (flag) {
        case "--request": {
          const v = value();
          if (v !== null) explicitMethod = v.toUpperCase();
          break;
        }
        case "--header": {
          const v = value();
          if (v !== null) addHeaderLine(v);
          break;
        }
        case "--data":
        case "--data-ascii":
        case "--data-binary": {
          const v = value();
          if (v !== null) pushData(v, true);
          break;
        }
        case "--data-raw": {
          const v = value();
          if (v !== null) pushData(v, false); // --data-raw treats @ literally
          break;
        }
        case "--data-urlencode": {
          const v = value();
          if (v !== null) pushDataUrlencode(v);
          break;
        }
        case "--json": {
          const v = value();
          if (v !== null) {
            pushData(v, true);
            jsonMode = true;
          }
          break;
        }
        case "--form": {
          const v = value();
          if (v !== null) pushForm(v, true);
          break;
        }
        case "--form-string": {
          const v = value();
          if (v !== null) pushForm(v, false);
          break;
        }
        case "--user": {
          const v = value();
          if (v !== null) setUser(v);
          break;
        }
        case "--cookie": {
          const v = value();
          if (v !== null) setCookie(v);
          break;
        }
        case "--user-agent": {
          const v = value();
          if (v !== null) setHeader(headers, "User-Agent", v);
          break;
        }
        case "--referer": {
          const v = value();
          if (v !== null) setHeader(headers, "Referer", v);
          break;
        }
        case "--oauth2-bearer": {
          const v = value();
          if (v !== null) setHeader(headers, "Authorization", `Bearer ${v}`);
          break;
        }
        case "--url": {
          const v = value();
          if (v !== null) urlFlag = v;
          break;
        }
        case "--location":
        case "--location-trusted":
          flags.location = true;
          break;
        case "--compressed":
          flags.compressed = true;
          break;
        case "--insecure":
          flags.insecure = true;
          break;
        case "--get":
          getMode = true;
          break;
        case "--head":
          headMode = true;
          break;
        case "--output":
          value(); // consume, ignore silently (like -o)
          break;
        case "--max-time":
        case "--connect-timeout": {
          value();
          warnTimeout(warnings, flag);
          break;
        }
        default:
          if (SILENT_BOOLEAN_LONG.has(flag)) break;
          if (CONSUMED_UNSUPPORTED_LONG.has(flag)) {
            value();
            warnIgnoredWithValue(warnings, flag);
            break;
          }
          // Unknown long flag: do NOT consume the next token (it may be the URL).
          warnUnknownFlag(warnings, flag);
          break;
      }
      continue;
    }

    if (token.startsWith("-") && token.length > 1) {
      const letters = token.slice(1);
      let consumed = false;
      for (let j = 0; j < letters.length && !consumed; j++) {
        const c = letters[j];
        const rest = letters.slice(j + 1);
        const shortValue = (): string | null => {
          consumed = true;
          return rest.length > 0 ? rest : nextValue(`-${c}`);
        };
        switch (c) {
          case "L":
            flags.location = true;
            break;
          case "k":
            flags.insecure = true;
            break;
          case "G":
            getMode = true;
            break;
          case "I":
            headMode = true;
            break;
          case "s":
          case "S":
          case "v":
          case "i":
          case "f":
          case "g":
          case "O":
            break; // ignored silently
          case "X": {
            const v = shortValue();
            if (v !== null) explicitMethod = v.toUpperCase();
            break;
          }
          case "H": {
            const v = shortValue();
            if (v !== null) addHeaderLine(v);
            break;
          }
          case "d": {
            const v = shortValue();
            if (v !== null) pushData(v, true);
            break;
          }
          case "F": {
            const v = shortValue();
            if (v !== null) pushForm(v, true);
            break;
          }
          case "u": {
            const v = shortValue();
            if (v !== null) setUser(v);
            break;
          }
          case "b": {
            const v = shortValue();
            if (v !== null) setCookie(v);
            break;
          }
          case "A": {
            const v = shortValue();
            if (v !== null) setHeader(headers, "User-Agent", v);
            break;
          }
          case "e": {
            const v = shortValue();
            if (v !== null) setHeader(headers, "Referer", v);
            break;
          }
          case "o":
            shortValue(); // consume, ignore silently
            break;
          case "m": {
            shortValue();
            warnTimeout(warnings, "-m");
            break;
          }
          case "x": {
            shortValue();
            warnIgnoredWithValue(warnings, "-x");
            break;
          }
          default:
            warnUnknownFlag(warnings, `-${c}`);
            break;
        }
      }
      continue;
    }

    positionals.push(token);
  }

  // ---- URL ----
  let url = urlFlag ?? positionals[0] ?? "";
  if (urlFlag !== null && positionals.length > 0) {
    pushWarning(
      warnings,
      `Có nhiều URL — chỉ dùng "${urlFlag}".`,
      `Multiple URLs found — only "${urlFlag}" is used.`,
    );
  } else if (positionals.length > 1) {
    pushWarning(
      warnings,
      `Có nhiều URL — chỉ dùng "${positionals[0]}".`,
      `Multiple URLs found — only "${positionals[0]}" is used.`,
    );
  }
  if (!url) {
    pushWarning(warnings, "Không tìm thấy URL trong lệnh.", "No URL found in the command.");
  } else if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(url)) {
    url = `https://${url}`;
    pushWarning(warnings, `URL thiếu scheme — đã thêm "https://".`, `URL had no scheme — "https://" was added.`);
  }

  // ---- Body ----
  let body: RequestBody | undefined;
  if (formParams.length > 0) {
    if (dataParts.length > 0) {
      pushWarning(
        warnings,
        "Không thể dùng -d cùng -F — chỉ giữ phần -F (multipart).",
        "-d cannot be combined with -F — keeping only the -F (multipart) parts.",
      );
    }
    body = {
      type: "multipart",
      params: formParams,
      raw: formParams.map(([k, v]) => `${k}=${v}`).join("\n"),
    };
  } else if (dataParts.length > 0) {
    const raw = dataParts.join("&");
    if (getMode) {
      url = url ? `${url}${url.includes("?") ? "&" : "?"}${raw}` : url;
      if (!url) {
        pushWarning(warnings, "-G: không có URL để gắn query string.", "-G: no URL to attach the query string to.");
      }
    } else {
      const contentType = findHeader(headers, "Content-Type")?.[1].toLowerCase() ?? null;
      let type: BodyType;
      if (jsonMode || (contentType !== null && contentType.includes("json"))) type = "json";
      else if (contentType !== null && contentType.includes("x-www-form-urlencoded")) type = "form-urlencoded";
      else if (contentType === null && looksLikeJson(raw)) type = "json";
      else if (contentType === null && /^[^=&\s]+=[^&]*(&[^=&\s]+=[^&]*)*$/.test(raw)) type = "form-urlencoded";
      else type = "raw";

      body = { type, raw };
      if (type === "form-urlencoded") {
        body.params = raw.split("&").map((pair) => {
          const eq = pair.indexOf("=");
          if (eq === -1) return [tryDecodeURIComponent(pair), ""] as [string, string];
          return [tryDecodeURIComponent(pair.slice(0, eq)), tryDecodeURIComponent(pair.slice(eq + 1))] as [
            string,
            string,
          ];
        });
      }
    }
  }

  // ---- Derived headers ----
  if (body?.type === "json" && !findHeader(headers, "Content-Type")) {
    headers.push(["Content-Type", "application/json"]);
  }
  if (body?.type === "form-urlencoded" && !findHeader(headers, "Content-Type")) {
    headers.push(["Content-Type", "application/x-www-form-urlencoded"]);
  }
  if (jsonMode && !findHeader(headers, "Accept")) {
    headers.push(["Accept", "application/json"]);
  }
  if (auth) {
    const encoded = base64Utf8(`${auth.user}:${auth.pass}`);
    if (encoded) setHeader(headers, "Authorization", `Basic ${encoded}`);
  }
  if (cookies) {
    const existing = findHeader(headers, "Cookie");
    if (existing) existing[1] = `${existing[1]}; ${cookies}`;
    else headers.push(["Cookie", cookies]);
  }

  const method =
    explicitMethod ?? (headMode ? "HEAD" : getMode ? "GET" : body !== undefined ? "POST" : "GET");

  return { kind: "http", method, url, headers, body, auth, cookies, flags, warnings };
}

// ---------------------------------------------------------------------------
// grpcurl parser
// ---------------------------------------------------------------------------

/** grpcurl value-taking flags (Go style: single or double dash). */
const GRPCURL_VALUE_FLAGS = new Set([
  "d",
  "H",
  "rpc-header",
  "reflect-header",
  "proto",
  "import-path",
  "protoset",
  "protoset-out",
  "cacert",
  "cert",
  "key",
  "authority",
  "servername",
  "connect-timeout",
  "keepalive-time",
  "max-time",
  "max-msg-sz",
  "format",
  "user-agent",
]);

const GRPCURL_BOOLEAN_FLAGS = new Set([
  "plaintext",
  "insecure",
  "v",
  "vv",
  "version",
  "emit-defaults",
  "allow-unknown-fields",
  "use-reflection",
  "format-error",
  "expand-headers",
]);

function parseGrpcurlTokens(tokens: string[]): RequestModel {
  const warnings: Localized[] = [];
  const metadata: Array<[string, string]> = [];
  const positionals: string[] = [];
  const flags = { location: false, compressed: false, insecure: false };

  let data = "";
  let plaintext = false;

  let i = 0;
  const nextValue = (flag: string): string | null => {
    if (i + 1 < tokens.length) {
      i++;
      return tokens[i];
    }
    warnMissingValue(warnings, flag);
    return null;
  };

  const addMetadata = (line: string) => {
    const idx = line.indexOf(":");
    if (idx === -1) {
      pushWarning(
        warnings,
        `Metadata không hợp lệ: "${line}" (thiếu dấu ":").`,
        `Invalid metadata: "${line}" (missing ":").`,
      );
      return;
    }
    metadata.push([line.slice(0, idx).trim(), line.slice(idx + 1).trim()]);
  };

  for (; i < tokens.length; i++) {
    const token = tokens[i];

    if (token.startsWith("-") && token.length > 1) {
      const stripped = token.replace(/^--?/, "");
      const eq = stripped.indexOf("=");
      const flag = eq === -1 ? stripped : stripped.slice(0, eq);
      const inline = eq === -1 ? null : stripped.slice(eq + 1);
      const value = (): string | null => inline ?? nextValue(`-${flag}`);

      if (flag === "d") {
        const v = value();
        if (v !== null) {
          if (v === "@") {
            pushWarning(
              warnings,
              "-d @: dữ liệu từ stdin không khả dụng — hãy dán JSON trực tiếp.",
              "-d @: stdin data is not available — paste the JSON inline instead.",
            );
          } else {
            data = v;
          }
        }
        continue;
      }
      if (flag === "H" || flag === "rpc-header") {
        const v = value();
        if (v !== null) addMetadata(v);
        continue;
      }
      if (flag === "proto" || flag === "import-path" || flag === "protoset") {
        const v = value();
        pushWarning(
          warnings,
          `-${flag} ${v ?? ""}: tệp .proto/protoset không khả dụng trong trình duyệt — dựa vào server reflection.`,
          `-${flag} ${v ?? ""}: .proto/protoset files are not available in the browser — relying on server reflection.`,
        );
        continue;
      }
      if (flag === "connect-timeout" || flag === "max-time" || flag === "keepalive-time") {
        value();
        warnTimeout(warnings, `-${flag}`);
        continue;
      }
      if (flag === "plaintext") {
        plaintext = true;
        continue;
      }
      if (flag === "insecure") {
        flags.insecure = true;
        continue;
      }
      if (GRPCURL_VALUE_FLAGS.has(flag)) {
        value();
        warnIgnoredWithValue(warnings, `-${flag}`);
        continue;
      }
      if (GRPCURL_BOOLEAN_FLAGS.has(flag)) continue;
      warnUnknownFlag(warnings, `-${flag}`);
      continue;
    }

    positionals.push(token);
  }

  let address = "";
  let method = "";
  if (positionals.length >= 2) {
    address = positionals[0];
    method = positionals[1];
    if (positionals.length > 2) {
      pushWarning(
        warnings,
        `Bỏ qua tham số thừa: ${positionals.slice(2).join(", ")}.`,
        `Ignored extra arguments: ${positionals.slice(2).join(", ")}.`,
      );
    }
  } else if (positionals.length === 1) {
    const only = positionals[0];
    if (only.includes(":") && !only.includes("/")) {
      address = only;
      pushWarning(
        warnings,
        "Thiếu tên method gRPC (package.Service/Method).",
        "Missing the gRPC method name (package.Service/Method).",
      );
    } else {
      method = only;
      pushWarning(warnings, "Thiếu địa chỉ server (host:port).", "Missing the server address (host:port).");
    }
  } else {
    pushWarning(
      warnings,
      "Thiếu địa chỉ server và tên method gRPC.",
      "Missing both the server address and the gRPC method name.",
    );
  }

  return {
    kind: "grpc",
    method: "POST",
    url: "",
    headers: [],
    flags,
    grpc: { address, method, data, metadata, plaintext },
    warnings,
  };
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

export function parseCommand(input: string): ParseOutcome {
  const tokens = tokenize(input);
  if (tokens.length === 0) return { model: null, error: null };

  const first = tokens[0].replace(/^.*[\\/]/, "").toLowerCase();
  if (first === "grpcurl" || first === "grpcurl.exe") {
    return { model: parseGrpcurlTokens(tokens.slice(1)), error: null };
  }
  if (first === "curl" || first === "curl.exe") {
    return { model: parseCurlTokens(tokens.slice(1)), error: null };
  }
  return {
    model: null,
    error: {
      vi: 'Lệnh phải bắt đầu bằng "curl" hoặc "grpcurl". Hãy dán nguyên lệnh (ví dụ từ Postman → Code → cURL).',
      en: 'The command must start with "curl" or "grpcurl". Paste the full command (e.g. from Postman → Code → cURL).',
    },
  };
}
