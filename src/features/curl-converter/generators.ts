/**
 * Code generators: RequestModel → cURL / fetch / Axios / Java HttpClient /
 * Spring WebClient, plus grpcurl / grpc-java for gRPC models.
 *
 * Every generator emits syntactically valid code with target-language string
 * escaping (backslash, quotes, newlines). Java bodies use text blocks.
 */

import type { RequestModel } from "./parse-curl";

// ---------------------------------------------------------------------------
// Escaping helpers
// ---------------------------------------------------------------------------

/** Shell double-quoted string: "…" with \ " $ ` escaped. */
function shellDq(s: string): string {
  return `"${s.replace(/([\\"$`])/g, "\\$1")}"`;
}

/** Shell single-quoted string: '…' with embedded ' as '\''. */
function shellSq(s: string): string {
  return `'${s.replace(/'/g, "'\\''")}'`;
}

/** JS / Java double-quoted string literal. */
function quote(s: string): string {
  return `"${s
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "\\r")
    .replace(/\t/g, "\\t")}"`;
}

/** Indent every non-empty line of `text` by `pad`, except the first line. */
function indentTail(text: string, pad: string): string {
  const lines = text.split("\n");
  return lines.map((line, idx) => (idx === 0 || line.length === 0 ? line : pad + line)).join("\n");
}

/** Pretty-print raw JSON, or null when not parseable. */
function prettyJson(raw: string): string | null {
  try {
    return JSON.stringify(JSON.parse(raw), null, 2);
  } catch {
    return null;
  }
}

/**
 * Java text block: escapes backslashes and `"""` sequences. The closing
 * delimiter is placed at `pad`, which defines the incidental indentation.
 */
function javaTextBlock(s: string, pad: string): string {
  const escaped = s.replace(/\\/g, "\\\\").replace(/"""/g, '\\"\\"\\"');
  const body = escaped
    .split("\n")
    .map((line) => (line.length > 0 ? pad + line : line))
    .join("\n");
  return `"""\n${body}\\\n${pad}"""`;
}

/** Java string expression for a body: text block when multiline, plain literal otherwise. */
function javaBodyExpr(raw: string, pad: string): string {
  if (raw.includes("\n") || raw.includes('"')) return javaTextBlock(raw, pad);
  return quote(raw);
}

/** Headers that java.net.http.HttpClient manages itself (setting them throws). */
const JAVA_RESTRICTED_HEADERS = new Set(["host", "connection", "content-length", "expect", "upgrade"]);

function isFileFormValue(value: string): boolean {
  return value.startsWith("@") || value.startsWith("<");
}

// ---------------------------------------------------------------------------
// cURL (canonical)
// ---------------------------------------------------------------------------

export function generateCurl(m: RequestModel): string {
  if (m.kind === "grpc") return generateGrpcurl(m);

  const parts: string[] = [];
  const hasBody = m.body !== undefined;
  if (m.method !== "GET" || hasBody) parts.push(`curl -X ${m.method} ${shellDq(m.url)}`);
  else parts.push(`curl ${shellDq(m.url)}`);

  for (const [name, value] of m.headers) {
    parts.push(`-H ${shellDq(`${name}: ${value}`)}`);
  }

  if (m.body) {
    if (m.body.type === "multipart") {
      for (const [k, v] of m.body.params ?? []) parts.push(`-F ${shellSq(`${k}=${v}`)}`);
    } else {
      const raw = m.body.raw ?? "";
      const payload = m.body.type === "json" ? (prettyJson(raw) ?? raw) : raw;
      parts.push(`--data-raw ${shellSq(payload)}`);
    }
  }

  if (m.flags.location) parts.push("-L");
  if (m.flags.compressed) parts.push("--compressed");
  if (m.flags.insecure) parts.push("-k");

  return parts.join(" \\\n  ");
}

// ---------------------------------------------------------------------------
// fetch
// ---------------------------------------------------------------------------

function wantsJsonResponse(m: RequestModel): boolean {
  const accept = m.headers.find(([k]) => k.toLowerCase() === "accept")?.[1].toLowerCase();
  if (accept) return accept.includes("json") || accept.includes("*/*");
  return m.body?.type === "json";
}

export function generateFetch(m: RequestModel): string {
  const bodyAllowed = m.method !== "GET" && m.method !== "HEAD";
  const isMultipart = m.body?.type === "multipart" && bodyAllowed;
  const headers = isMultipart
    ? m.headers.filter(([k]) => k.toLowerCase() !== "content-type")
    : m.headers;

  const lines: string[] = [];
  lines.push("async function makeRequest() {");

  if (isMultipart) {
    lines.push("  const form = new FormData();");
    for (const [k, v] of m.body?.params ?? []) {
      const comment = isFileFormValue(v) ? " // file contents unavailable — append a File/Blob here" : "";
      lines.push(`  form.append(${quote(k)}, ${quote(v)});${comment}`);
    }
    lines.push("");
  }

  const optionLines: string[] = [];
  optionLines.push(`    method: ${quote(m.method)},`);

  if (headers.length > 0) {
    optionLines.push("    headers: {");
    for (const [k, v] of headers) optionLines.push(`      ${quote(k)}: ${quote(v)},`);
    if (isMultipart) optionLines.push("      // Content-Type is set automatically with the multipart boundary");
    optionLines.push("    },");
  } else if (isMultipart) {
    optionLines.push("    // Content-Type is set automatically with the multipart boundary");
  }

  if (m.body && !bodyAllowed) {
    optionLines.push(`    // ${m.method} requests cannot carry a body — body omitted`);
  } else if (m.body) {
    if (isMultipart) {
      optionLines.push("    body: form,");
    } else if (m.body.type === "json") {
      const pretty = prettyJson(m.body.raw ?? "");
      if (pretty !== null) {
        optionLines.push(`    body: JSON.stringify(${indentTail(pretty, "    ")}),`);
      } else {
        optionLines.push(`    body: ${quote(m.body.raw ?? "")},`);
      }
    } else if (m.body.type === "form-urlencoded" && m.body.params && m.body.params.length > 0) {
      optionLines.push("    body: new URLSearchParams({");
      for (const [k, v] of m.body.params) optionLines.push(`      ${quote(k)}: ${quote(v)},`);
      optionLines.push("    }),");
    } else {
      optionLines.push(`    body: ${quote(m.body.raw ?? "")},`);
    }
  }

  if (m.flags.location) optionLines.push('    redirect: "follow",');

  lines.push(`  const response = await fetch(${quote(m.url)}, {`);
  lines.push(...optionLines);
  lines.push("  });");
  lines.push("");
  lines.push("  if (!response.ok) {");
  lines.push("    throw new Error(`HTTP ${response.status} ${response.statusText}`);");
  lines.push("  }");
  lines.push(`  return response.${wantsJsonResponse(m) ? "json" : "text"}();`);
  lines.push("}");
  lines.push("");
  lines.push("makeRequest()");
  lines.push("  .then((data) => console.log(data))");
  lines.push("  .catch((error) => console.error(error));");

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Axios
// ---------------------------------------------------------------------------

export function generateAxios(m: RequestModel): string {
  const bodyAllowed = m.method !== "GET" && m.method !== "HEAD";
  const isMultipart = m.body?.type === "multipart" && bodyAllowed;
  const headers = isMultipart
    ? m.headers.filter(([k]) => k.toLowerCase() !== "content-type")
    : m.headers;

  const lines: string[] = [];
  lines.push('import axios from "axios";');
  lines.push("");
  lines.push("async function makeRequest() {");

  if (isMultipart) {
    lines.push("  const form = new FormData();");
    for (const [k, v] of m.body?.params ?? []) {
      const comment = isFileFormValue(v) ? " // file contents unavailable — append a File/Blob here" : "";
      lines.push(`  form.append(${quote(k)}, ${quote(v)});${comment}`);
    }
    lines.push("");
  }

  lines.push("  try {");
  lines.push("    const response = await axios({");
  lines.push(`      method: ${quote(m.method.toLowerCase())},`);
  lines.push(`      url: ${quote(m.url)},`);

  if (headers.length > 0) {
    lines.push("      headers: {");
    for (const [k, v] of headers) lines.push(`        ${quote(k)}: ${quote(v)},`);
    lines.push("      },");
  }

  if (m.body && !bodyAllowed) {
    lines.push(`      // ${m.method} requests cannot carry a body — data omitted`);
  } else if (m.body) {
    if (isMultipart) {
      lines.push("      data: form,");
    } else if (m.body.type === "json") {
      const pretty = prettyJson(m.body.raw ?? "");
      if (pretty !== null) {
        lines.push(`      data: ${indentTail(pretty, "      ")},`);
      } else {
        lines.push(`      data: ${quote(m.body.raw ?? "")},`);
      }
    } else if (m.body.type === "form-urlencoded" && m.body.params && m.body.params.length > 0) {
      lines.push("      data: new URLSearchParams({");
      for (const [k, v] of m.body.params) lines.push(`        ${quote(k)}: ${quote(v)},`);
      lines.push("      }),");
    } else {
      lines.push(`      data: ${quote(m.body.raw ?? "")},`);
    }
  }

  if (m.flags.insecure) {
    lines.push("      // -k/--insecure: in Node.js pass httpsAgent: new https.Agent({ rejectUnauthorized: false })");
  }
  lines.push("    });");
  lines.push("    console.log(response.status, response.data);");
  lines.push("    return response.data;");
  lines.push("  } catch (error) {");
  lines.push("    if (axios.isAxiosError(error)) {");
  lines.push('      console.error("Request failed:", error.response?.status, error.response?.data);');
  lines.push("    } else {");
  lines.push("      console.error(error);");
  lines.push("    }");
  lines.push("    throw error;");
  lines.push("  }");
  lines.push("}");
  lines.push("");
  lines.push("makeRequest();");

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Java HttpClient (java.net.http, JDK 11+, text blocks JDK 15+)
// ---------------------------------------------------------------------------

export function generateJavaHttpClient(m: RequestModel): string {
  const isMultipart = m.body?.type === "multipart";
  const skipped: string[] = [];
  const headers = m.headers.filter(([k]) => {
    if (JAVA_RESTRICTED_HEADERS.has(k.toLowerCase())) {
      skipped.push(k);
      return false;
    }
    if (isMultipart && k.toLowerCase() === "content-type") return false;
    return true;
  });

  const lines: string[] = [];
  lines.push("import java.net.URI;");
  lines.push("import java.net.http.HttpClient;");
  lines.push("import java.net.http.HttpRequest;");
  lines.push("import java.net.http.HttpResponse;");
  lines.push("");
  lines.push("public class ApiClient {");
  lines.push("");
  lines.push("    public static void main(String[] args) throws Exception {");

  let bodyVar: string | null = null;
  if (m.body) {
    if (isMultipart) {
      lines.push('        String boundary = "----DevTilityFormBoundary";');
      lines.push("        StringBuilder sb = new StringBuilder();");
      for (const [k, v] of m.body.params ?? []) {
        lines.push(`        sb.append("--").append(boundary).append("\\r\\n");`);
        lines.push(
          `        sb.append("Content-Disposition: form-data; name=\\"").append(${quote(k)}).append("\\"\\r\\n\\r\\n");`,
        );
        const comment = isFileFormValue(v) ? " // file contents unavailable — inline the real bytes" : "";
        lines.push(`        sb.append(${quote(v)}).append("\\r\\n");${comment}`);
      }
      lines.push(`        sb.append("--").append(boundary).append("--\\r\\n");`);
      lines.push("        String body = sb.toString();");
      bodyVar = "body";
    } else {
      const raw = m.body.type === "json" ? (prettyJson(m.body.raw ?? "") ?? (m.body.raw ?? "")) : (m.body.raw ?? "");
      lines.push(`        String body = ${javaBodyExpr(raw, "            ")};`);
      bodyVar = "body";
    }
    lines.push("");
  }

  lines.push("        HttpRequest request = HttpRequest.newBuilder()");
  lines.push(`                .uri(URI.create(${quote(m.url)}))`);
  for (const [k, v] of headers) {
    lines.push(`                .header(${quote(k)}, ${quote(v)})`);
  }
  if (skipped.length > 0) {
    lines.push(`                // headers managed by HttpClient were skipped: ${skipped.join(", ")}`);
  }
  if (isMultipart) {
    lines.push('                .header("Content-Type", "multipart/form-data; boundary=" + boundary)');
  }
  if (bodyVar) {
    lines.push(`                .method(${quote(m.method)}, HttpRequest.BodyPublishers.ofString(${bodyVar}))`);
  } else if (m.method === "GET") {
    lines.push("                .GET()");
  } else {
    lines.push(`                .method(${quote(m.method)}, HttpRequest.BodyPublishers.noBody())`);
  }
  lines.push("                .build();");
  lines.push("");

  if (m.flags.location) {
    lines.push("        HttpClient client = HttpClient.newBuilder()");
    lines.push("                .followRedirects(HttpClient.Redirect.NORMAL)");
    lines.push("                .build();");
  } else {
    lines.push("        HttpClient client = HttpClient.newHttpClient();");
  }
  if (m.flags.insecure) {
    lines.push("        // -k/--insecure: configure a trust-all SSLContext via HttpClient.newBuilder().sslContext(...)");
  }
  lines.push("");
  lines.push("        HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());");
  lines.push("        System.out.println(response.statusCode());");
  lines.push("        System.out.println(response.body());");
  lines.push("    }");
  lines.push("}");

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Spring WebClient
// ---------------------------------------------------------------------------

export function generateSpringWebClient(m: RequestModel): string {
  const isMultipart = m.body?.type === "multipart";
  const isForm = m.body?.type === "form-urlencoded" && (m.body.params?.length ?? 0) > 0;
  const headers = isMultipart ? m.headers.filter(([k]) => k.toLowerCase() !== "content-type") : m.headers;

  const lines: string[] = [];
  lines.push("import org.springframework.http.HttpMethod;");
  if (isMultipart) lines.push("import org.springframework.http.client.MultipartBodyBuilder;");
  if (isMultipart || isForm) lines.push("import org.springframework.web.reactive.function.BodyInserters;");
  lines.push("import org.springframework.web.reactive.function.client.WebClient;");
  lines.push("");
  lines.push("public class ApiClient {");
  lines.push("");
  lines.push("    public static void main(String[] args) {");

  let bodyVar: string | null = null;
  if (m.body && !isMultipart && !isForm) {
    const raw = m.body.type === "json" ? (prettyJson(m.body.raw ?? "") ?? (m.body.raw ?? "")) : (m.body.raw ?? "");
    lines.push(`        String body = ${javaBodyExpr(raw, "            ")};`);
    lines.push("");
    bodyVar = "body";
  }
  if (isMultipart) {
    lines.push("        MultipartBodyBuilder builder = new MultipartBodyBuilder();");
    for (const [k, v] of m.body?.params ?? []) {
      const comment = isFileFormValue(v) ? " // file contents unavailable — pass a Resource here" : "";
      lines.push(`        builder.part(${quote(k)}, ${quote(v)});${comment}`);
    }
    lines.push("");
  }

  lines.push("        String response = WebClient.create()");
  lines.push(`                .method(HttpMethod.${/^[A-Z]+$/.test(m.method) ? m.method : "POST"})`);
  lines.push(`                .uri(${quote(m.url)})`);
  if (headers.length > 0) {
    lines.push("                .headers(h -> {");
    for (const [k, v] of headers) {
      lines.push(`                    h.set(${quote(k)}, ${quote(v)});`);
    }
    lines.push("                })");
  }
  if (isMultipart) {
    lines.push("                .body(BodyInserters.fromMultipartData(builder.build()))");
  } else if (isForm) {
    const params = m.body?.params ?? [];
    const [first, ...rest] = params;
    let inserter = `BodyInserters.fromFormData(${quote(first[0])}, ${quote(first[1])})`;
    for (const [k, v] of rest) inserter += `\n                        .with(${quote(k)}, ${quote(v)})`;
    lines.push(`                .body(${inserter})`);
  } else if (bodyVar) {
    lines.push(`                .bodyValue(${bodyVar})`);
  }
  lines.push("                .retrieve()");
  lines.push("                .bodyToMono(String.class)");
  lines.push("                .block();");
  lines.push("");
  lines.push("        System.out.println(response);");
  lines.push("    }");
  lines.push("}");

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// grpcurl (canonical)
// ---------------------------------------------------------------------------

export function generateGrpcurl(m: RequestModel): string {
  const g = m.grpc;
  if (!g) return "";

  const parts: string[] = ["grpcurl"];
  if (g.plaintext) parts.push("-plaintext");
  if (m.flags.insecure) parts.push("-insecure");
  for (const [k, v] of g.metadata) parts.push(`-H ${shellDq(`${k}: ${v}`)}`);
  if (g.data) parts.push(`-d ${shellSq(g.data)}`);
  parts.push(g.address || "<host:port>");
  parts.push(g.method || "<package.Service/Method>");

  return parts.join(" \\\n  ");
}

// ---------------------------------------------------------------------------
// grpc-java
// ---------------------------------------------------------------------------

export function generateGrpcJava(m: RequestModel): string {
  const g = m.grpc;
  if (!g) return "";

  const [servicePath = "", rpcName = ""] = g.method.split("/");
  const serviceName = servicePath.split(".").pop() || "YourService";
  const stubClass = `${serviceName}Grpc`;
  const rpcUpper = rpcName || "YourMethod";
  const rpcLower = rpcUpper.charAt(0).toLowerCase() + rpcUpper.slice(1);
  const requestType = `${rpcUpper.charAt(0).toUpperCase()}${rpcUpper.slice(1)}Request`;
  const responseType = `${rpcUpper.charAt(0).toUpperCase()}${rpcUpper.slice(1)}Response`;

  const lines: string[] = [];
  lines.push("import io.grpc.ManagedChannel;");
  lines.push("import io.grpc.ManagedChannelBuilder;");
  if (g.metadata.length > 0) {
    lines.push("import io.grpc.Metadata;");
    lines.push("import io.grpc.stub.MetadataUtils;");
  }
  lines.push("");
  lines.push("public class GrpcClient {");
  lines.push("");
  lines.push("    public static void main(String[] args) throws Exception {");
  lines.push("        ManagedChannel channel = ManagedChannelBuilder");
  lines.push(`                .forTarget(${quote(g.address || "localhost:50051")})`);
  if (g.plaintext) {
    lines.push("                .usePlaintext() // -plaintext: no TLS");
  }
  lines.push("                .build();");
  lines.push("");

  if (g.metadata.length > 0) {
    lines.push("        // Metadata from the -H flags");
    lines.push("        Metadata metadata = new Metadata();");
    for (const [k, v] of g.metadata) {
      lines.push(
        `        metadata.put(Metadata.Key.of(${quote(k.toLowerCase())}, Metadata.ASCII_STRING_MARSHALLER), ${quote(v)});`,
      );
    }
    lines.push("");
  }

  lines.push(`        // Blocking stub generated from your .proto for ${servicePath || "your service"}:`);
  lines.push(`        // ${stubClass}.${serviceName}BlockingStub stub = ${stubClass}`);
  if (g.metadata.length > 0) {
    lines.push("        //         .newBlockingStub(channel)");
    lines.push("        //         .withInterceptors(MetadataUtils.newAttachHeadersInterceptor(metadata));");
  } else {
    lines.push("        //         .newBlockingStub(channel);");
  }
  lines.push("        //");
  lines.push(`        // Build the request message mirroring the -d JSON payload:`);
  if (g.data) {
    for (const line of g.data.split("\n")) {
      lines.push(`        //   ${line}`);
    }
  } else {
    lines.push("        //   (no -d payload — an empty request message)");
  }
  lines.push(`        // ${requestType} request = ${requestType}.newBuilder()`);
  lines.push("        //         // .setField(...) for each JSON field above");
  lines.push("        //         .build();");
  lines.push(`        // ${responseType} response = stub.${rpcLower}(request);`);
  lines.push("        // System.out.println(response);");
  lines.push("");
  lines.push("        channel.shutdown();");
  lines.push("    }");
  lines.push("}");

  return lines.join("\n");
}
