"use client";

import { AlertTriangle, Info, Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { CopyButton } from "@/components/ui/copy-button";
import { Field, Select, TextArea, TextInput } from "@/components/ui/field";
import { Tabs } from "@/components/ui/tabs";
import type { Localized } from "@/lib/i18n";
import { useI18n } from "@/lib/i18n/use-lang";

import {
  generateAxios,
  generateCurl,
  generateFetch,
  generateGrpcJava,
  generateGrpcurl,
  generateJavaHttpClient,
  generateSpringWebClient,
} from "./generators";
import { parseCommand, type RequestModel } from "./parse-curl";

// ---------------------------------------------------------------------------
// Messages
// ---------------------------------------------------------------------------

const M = {
  inputTitle: { vi: "Lệnh cURL / grpcurl", en: "cURL / grpcurl command" },
  inputSubtitle: {
    vi: "Dán lệnh (hỗ trợ nhiều dòng, Postman export, grpcurl) — phân tích tự động",
    en: "Paste a command (multiline, Postman exports, grpcurl supported) — parsed automatically",
  },
  inputPlaceholder: {
    vi: "curl -X POST 'https://api.example.com/…' -H 'Content-Type: application/json' -d '{…}'",
    en: "curl -X POST 'https://api.example.com/…' -H 'Content-Type: application/json' -d '{…}'",
  },
  sampleCurl: { vi: "cURL mẫu", en: "Sample cURL" },
  sampleGrpcurl: { vi: "grpcurl mẫu", en: "Sample grpcurl" },
  clear: { vi: "Xóa", en: "Clear" },
  modelTitle: { vi: "Request model", en: "Request model" },
  modelSubtitle: {
    vi: "Chỉnh sửa bất kỳ trường nào — code sinh ra cập nhật ngay",
    en: "Edit any field — the generated code updates instantly",
  },
  method: { vi: "Method", en: "Method" },
  urlLabel: { vi: "URL", en: "URL" },
  headersLabel: { vi: "Headers", en: "Headers" },
  addHeader: { vi: "Thêm header", en: "Add header" },
  headerName: { vi: "Tên header", en: "Header name" },
  headerValue: { vi: "Giá trị", en: "Value" },
  removeRow: { vi: "Xóa dòng", en: "Remove row" },
  noHeaders: { vi: "Chưa có header nào.", en: "No headers yet." },
  bodyLabel: { vi: "Body", en: "Body" },
  bodyTypeLabel: { vi: "Loại", en: "Type" },
  multipartHint: {
    vi: "Mỗi dòng một trường dạng key=value.",
    en: "One key=value field per line.",
  },
  noBody: { vi: "Request không có body.", en: "The request has no body." },
  warningsTitle: { vi: "Cảnh báo", en: "Warnings" },
  outputsTitle: { vi: "Code sinh ra", en: "Generated code" },
  outputsSubtitle: {
    vi: "Chọn ngôn ngữ đích và sao chép",
    en: "Pick a target and copy",
  },
  copy: { vi: "Sao chép", en: "Copy" },
  grpcTitle: { vi: "gRPC request model", en: "gRPC request model" },
  grpcSubtitle: {
    vi: "Chỉnh sửa address, method, payload và metadata",
    en: "Edit the address, method, payload and metadata",
  },
  grpcAddress: { vi: "Địa chỉ (host:port)", en: "Address (host:port)" },
  grpcMethod: { vi: "Method (package.Service/Method)", en: "Method (package.Service/Method)" },
  grpcData: { vi: "Payload (-d, JSON)", en: "Payload (-d, JSON)" },
  grpcMetadata: { vi: "Metadata (-H)", en: "Metadata (-H)" },
  addMetadata: { vi: "Thêm metadata", en: "Add metadata" },
  noMetadata: { vi: "Chưa có metadata nào.", en: "No metadata yet." },
  plaintext: { vi: "-plaintext (không TLS)", en: "-plaintext (no TLS)" },
  grpcBanner: {
    vi: "Lệnh gRPC không chuyển được sang fetch/Axios (HTTP/2 + protobuf).",
    en: "gRPC commands can't be converted to fetch/Axios (HTTP/2 + protobuf).",
  },
  emptyHint: {
    vi: "Dán lệnh curl hoặc grpcurl ở trên, hoặc bấm một nút mẫu để bắt đầu.",
    en: "Paste a curl or grpcurl command above, or press a sample button to get started.",
  },
} satisfies Record<string, Localized>;

// ---------------------------------------------------------------------------
// Samples
// ---------------------------------------------------------------------------

const SAMPLE_CURL = String.raw`curl --location --request POST 'https://api.example.com/v1/orders' \
--header 'Content-Type: application/json' \
--header 'Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.demo-token' \
--data-raw '{
    "customerId": "c-1024",
    "items": [
        {
            "sku": "SKU-4419",
            "quantity": 2
        }
    ],
    "note": "Giao trong giờ hành chính"
}'`;

const SAMPLE_GRPCURL = String.raw`grpcurl -plaintext \
  -H 'authorization: Bearer eyJhbGciOiJIUzI1NiJ9.demo-token' \
  -d '{"orderId": "c-1024", "includeItems": true}' \
  localhost:50051 \
  shop.v1.OrderService/GetOrder`;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const METHOD_OPTIONS = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"];

type HttpTarget = "curl" | "fetch" | "axios" | "java" | "spring";
type GrpcTarget = "grpcurl" | "grpc-java";

const HTTP_TABS: ReadonlyArray<{ value: HttpTarget; label: string }> = [
  { value: "curl", label: "cURL" },
  { value: "fetch", label: "fetch" },
  { value: "axios", label: "Axios" },
  { value: "java", label: "Java HttpClient" },
  { value: "spring", label: "Spring WebClient" },
];

const GRPC_TABS: ReadonlyArray<{ value: GrpcTarget; label: string }> = [
  { value: "grpcurl", label: "grpcurl" },
  { value: "grpc-java", label: "Java (grpc-java)" },
];

// ---------------------------------------------------------------------------
// Small building blocks
// ---------------------------------------------------------------------------

function CodeBlock({ code }: { code: string }) {
  return (
    <pre className="overflow-x-auto rounded-lg border border-border bg-muted/40 p-4 font-mono text-xs leading-relaxed text-foreground">
      {code}
    </pre>
  );
}

function WarningList({ warnings }: { warnings: Localized[] }) {
  const { t } = useI18n();
  if (warnings.length === 0) return null;
  return (
    <div className="space-y-1.5 rounded-lg border border-warning/30 bg-warning/5 px-3 py-2.5">
      <p className="text-xs font-medium uppercase tracking-wider text-warning">{t(M.warningsTitle)}</p>
      <ul className="space-y-1">
        {warnings.map((w, idx) => (
          <li key={idx} className="flex items-start gap-2 text-xs text-warning">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>{t(w)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Editable name/value pair table used for headers and gRPC metadata. */
function PairTable({
  pairs,
  onChange,
  addLabel,
  emptyLabel,
  idPrefix,
}: {
  pairs: Array<[string, string]>;
  onChange: (pairs: Array<[string, string]>) => void;
  addLabel: string;
  emptyLabel: string;
  idPrefix: string;
}) {
  const { t } = useI18n();
  return (
    <div className="space-y-2">
      {pairs.length === 0 ? <p className="text-xs text-muted-foreground">{emptyLabel}</p> : null}
      {pairs.map(([name, value], idx) => (
        <div key={idx} className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1.4fr_auto]">
          <TextInput
            aria-label={`${t(M.headerName)} ${idx + 1}`}
            id={`${idPrefix}-name-${idx}`}
            value={name}
            placeholder={t(M.headerName)}
            className="h-9 font-mono text-xs"
            autoComplete="off"
            spellCheck={false}
            onChange={(e) => {
              const next = pairs.map((p, i) => (i === idx ? ([e.target.value, p[1]] as [string, string]) : p));
              onChange(next);
            }}
          />
          <TextInput
            aria-label={`${t(M.headerValue)} ${idx + 1}`}
            id={`${idPrefix}-value-${idx}`}
            value={value}
            placeholder={t(M.headerValue)}
            className="h-9 font-mono text-xs"
            autoComplete="off"
            spellCheck={false}
            onChange={(e) => {
              const next = pairs.map((p, i) => (i === idx ? ([p[0], e.target.value] as [string, string]) : p));
              onChange(next);
            }}
          />
          <Button
            variant="ghost"
            size="icon"
            aria-label={t(M.removeRow)}
            title={t(M.removeRow)}
            className="h-9 w-9 text-muted-foreground hover:text-danger"
            onClick={() => onChange(pairs.filter((_, i) => i !== idx))}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ))}
      <Button variant="outline" size="sm" onClick={() => onChange([...pairs, ["", ""]])}>
        <Plus className="h-3.5 w-3.5" />
        {addLabel}
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tool
// ---------------------------------------------------------------------------

export default function CurlConverterTool() {
  const { t } = useI18n();
  const [input, setInput] = useState("");
  const [model, setModel] = useState<RequestModel | null>(null);
  const [parseError, setParseError] = useState<Localized | null>(null);
  const [httpTab, setHttpTab] = useState<HttpTarget>("fetch");
  const [grpcTab, setGrpcTab] = useState<GrpcTarget>("grpcurl");

  // Debounced live parse (~300ms).
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!input.trim()) {
        setModel(null);
        setParseError(null);
        return;
      }
      const outcome = parseCommand(input);
      setModel(outcome.model);
      setParseError(outcome.error);
    }, 300);
    return () => clearTimeout(timer);
  }, [input]);

  const patchModel = (patch: Partial<RequestModel>) => {
    setModel((prev) => (prev ? { ...prev, ...patch } : prev));
  };

  const patchGrpc = (patch: Partial<NonNullable<RequestModel["grpc"]>>) => {
    setModel((prev) => (prev && prev.grpc ? { ...prev, grpc: { ...prev.grpc, ...patch } } : prev));
  };

  const setBodyText = (text: string) => {
    setModel((prev) => {
      if (!prev || !prev.body) return prev;
      if (prev.body.type === "multipart") {
        const params = text
          .split("\n")
          .map((line) => line.trim())
          .filter((line) => line.length > 0)
          .map((line) => {
            const eq = line.indexOf("=");
            return (eq === -1 ? [line, ""] : [line.slice(0, eq), line.slice(eq + 1)]) as [string, string];
          });
        return { ...prev, body: { ...prev.body, params, raw: text } };
      }
      return { ...prev, body: { ...prev.body, raw: text } };
    });
  };

  const outputs = useMemo(() => {
    if (!model) return null;
    if (model.kind === "grpc") {
      return {
        grpcurl: generateGrpcurl(model),
        "grpc-java": generateGrpcJava(model),
      } as Record<GrpcTarget, string>;
    }
    return {
      curl: generateCurl(model),
      fetch: generateFetch(model),
      axios: generateAxios(model),
      java: generateJavaHttpClient(model),
      spring: generateSpringWebClient(model),
    } as Record<HttpTarget, string>;
  }, [model]);

  const methodOptions = useMemo(() => {
    if (!model || METHOD_OPTIONS.includes(model.method)) return METHOD_OPTIONS;
    return [model.method, ...METHOD_OPTIONS];
  }, [model]);

  const activeCode =
    model && outputs
      ? model.kind === "grpc"
        ? (outputs as Record<GrpcTarget, string>)[grpcTab]
        : (outputs as Record<HttpTarget, string>)[httpTab]
      : "";

  return (
    <div className="space-y-6">
      {/* ---- Input ---- */}
      <Card>
        <CardHeader
          title={t(M.inputTitle)}
          subtitle={t(M.inputSubtitle)}
          actions={
            input ? (
              <Button variant="ghost" size="sm" onClick={() => setInput("")}>
                {t(M.clear)}
              </Button>
            ) : undefined
          }
        />
        <CardBody className="space-y-3">
          <TextArea
            aria-label={t(M.inputTitle)}
            rows={7}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={t(M.inputPlaceholder)}
            spellCheck={false}
          />
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setInput(SAMPLE_CURL)}>
              {t(M.sampleCurl)}
            </Button>
            <Button variant="outline" size="sm" onClick={() => setInput(SAMPLE_GRPCURL)}>
              {t(M.sampleGrpcurl)}
            </Button>
          </div>
          {parseError ? <p className="text-sm text-danger">{t(parseError)}</p> : null}
          {!model && !parseError && !input.trim() ? (
            <p className="text-xs text-muted-foreground">{t(M.emptyHint)}</p>
          ) : null}
        </CardBody>
      </Card>

      {/* ---- HTTP request model ---- */}
      {model && model.kind === "http" ? (
        <Card>
          <CardHeader title={t(M.modelTitle)} subtitle={t(M.modelSubtitle)} />
          <CardBody className="space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-[9rem_1fr]">
              <Field label={t(M.method)} htmlFor="cc-method">
                <Select
                  id="cc-method"
                  value={model.method}
                  onChange={(e) => patchModel({ method: e.target.value })}
                  className="font-mono"
                >
                  {methodOptions.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label={t(M.urlLabel)} htmlFor="cc-url">
                <TextInput
                  id="cc-url"
                  value={model.url}
                  onChange={(e) => patchModel({ url: e.target.value })}
                  className="font-mono"
                  autoComplete="off"
                  spellCheck={false}
                />
              </Field>
            </div>

            <Field label={t(M.headersLabel)}>
              <PairTable
                pairs={model.headers}
                onChange={(headers) => patchModel({ headers })}
                addLabel={t(M.addHeader)}
                emptyLabel={t(M.noHeaders)}
                idPrefix="cc-header"
              />
            </Field>

            <div>
              <div className="mb-1.5 flex items-center gap-2">
                <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  {t(M.bodyLabel)}
                </span>
                {model.body ? (
                  <span className="rounded-md bg-primary/10 px-2 py-0.5 font-mono text-xs text-primary">
                    {model.body.type}
                  </span>
                ) : null}
              </div>
              {model.body ? (
                <>
                  <TextArea
                    aria-label={t(M.bodyLabel)}
                    rows={5}
                    value={
                      model.body.type === "multipart"
                        ? (model.body.raw ?? (model.body.params ?? []).map(([k, v]) => `${k}=${v}`).join("\n"))
                        : (model.body.raw ?? "")
                    }
                    onChange={(e) => setBodyText(e.target.value)}
                    spellCheck={false}
                  />
                  {model.body.type === "multipart" ? (
                    <p className="mt-1 text-xs text-muted-foreground">{t(M.multipartHint)}</p>
                  ) : null}
                </>
              ) : (
                <p className="text-xs text-muted-foreground">{t(M.noBody)}</p>
              )}
            </div>

            <WarningList warnings={model.warnings} />
          </CardBody>
        </Card>
      ) : null}

      {/* ---- gRPC request model ---- */}
      {model && model.kind === "grpc" && model.grpc ? (
        <Card>
          <CardHeader title={t(M.grpcTitle)} subtitle={t(M.grpcSubtitle)} />
          <CardBody className="space-y-4">
            <div className="flex items-start gap-2 rounded-lg border border-primary/30 bg-primary/10 px-3 py-2.5 text-sm text-primary">
              <Info className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{t(M.grpcBanner)}</span>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label={t(M.grpcAddress)} htmlFor="cc-grpc-address">
                <TextInput
                  id="cc-grpc-address"
                  value={model.grpc.address}
                  onChange={(e) => patchGrpc({ address: e.target.value })}
                  className="font-mono"
                  autoComplete="off"
                  spellCheck={false}
                />
              </Field>
              <Field label={t(M.grpcMethod)} htmlFor="cc-grpc-method">
                <TextInput
                  id="cc-grpc-method"
                  value={model.grpc.method}
                  onChange={(e) => patchGrpc({ method: e.target.value })}
                  className="font-mono"
                  autoComplete="off"
                  spellCheck={false}
                />
              </Field>
            </div>

            <Field label={t(M.grpcData)} htmlFor="cc-grpc-data">
              <TextArea
                id="cc-grpc-data"
                rows={4}
                value={model.grpc.data}
                onChange={(e) => patchGrpc({ data: e.target.value })}
                spellCheck={false}
              />
            </Field>

            <Field label={t(M.grpcMetadata)}>
              <PairTable
                pairs={model.grpc.metadata}
                onChange={(metadata) => patchGrpc({ metadata })}
                addLabel={t(M.addMetadata)}
                emptyLabel={t(M.noMetadata)}
                idPrefix="cc-meta"
              />
            </Field>

            <label className="flex cursor-pointer items-center gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                checked={model.grpc.plaintext}
                onChange={(e) => patchGrpc({ plaintext: e.target.checked })}
                className="h-4 w-4 accent-(--primary)"
              />
              <span className="font-mono text-xs">{t(M.plaintext)}</span>
            </label>

            <WarningList warnings={model.warnings} />
          </CardBody>
        </Card>
      ) : null}

      {/* ---- Outputs ---- */}
      {model && outputs ? (
        <Card>
          <CardHeader title={t(M.outputsTitle)} subtitle={t(M.outputsSubtitle)} />
          <CardBody className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              {model.kind === "grpc" ? (
                <Tabs items={GRPC_TABS} value={grpcTab} onChange={setGrpcTab} size="sm" />
              ) : (
                <Tabs items={HTTP_TABS} value={httpTab} onChange={setHttpTab} size="sm" />
              )}
              <CopyButton text={activeCode} label={t(M.copy)} />
            </div>
            <CodeBlock code={activeCode} />
          </CardBody>
        </Card>
      ) : null}
    </div>
  );
}
