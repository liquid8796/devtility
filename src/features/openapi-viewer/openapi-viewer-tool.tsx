"use client";

import { AlertTriangle, ChevronDown, ChevronRight, FileJson, Loader2, Search, Server } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { CopyButton } from "@/components/ui/copy-button";
import { Field, TextArea, TextInput } from "@/components/ui/field";
import { Tabs } from "@/components/ui/tabs";
import type { Localized } from "@/lib/i18n";
import { useI18n } from "@/lib/i18n/use-lang";
import { cn } from "@/lib/utils";

import {
  FILTERABLE_METHODS,
  parseSpec,
  type OperationView,
  type ResponseView,
  type SpecView,
} from "./parse-spec";
import { buildSampleRequest, exampleFromSchema } from "./sample";
import { SAMPLE_SPEC } from "./sample-spec";

// ---------------------------------------------------------------------------
// Messages
// ---------------------------------------------------------------------------

const M = {
  inputTitle: { vi: "OpenAPI / Swagger spec", en: "OpenAPI / Swagger spec" },
  inputSubtitle: {
    vi: "Dán spec JSON hoặc YAML (OpenAPI 3.x, Swagger 2) — phân tích tự động",
    en: "Paste a JSON or YAML spec (OpenAPI 3.x, Swagger 2) — parsed automatically",
  },
  pastePlaceholder: {
    vi: 'openapi: "3.0.3"\ninfo:\n  title: My API\n  version: 1.0.0\npaths:\n  /users: …',
    en: 'openapi: "3.0.3"\ninfo:\n  title: My API\n  version: 1.0.0\npaths:\n  /users: …',
  },
  loadFromUrl: { vi: "Tải từ URL", en: "Load from URL" },
  urlPlaceholder: { vi: "https://example.com/openapi.json", en: "https://example.com/openapi.json" },
  loadBtn: { vi: "Tải", en: "Load" },
  sampleBtn: { vi: "Spec mẫu", en: "Sample spec" },
  clear: { vi: "Xóa", en: "Clear" },
  loadError: {
    vi: "Không tải được spec từ URL — server có thể chặn CORS hoặc URL không tồn tại. Hãy tải tệp về rồi dán nội dung vào ô trên.",
    en: "Could not load the spec from that URL — the server may block CORS or the URL does not exist. Download the file and paste its content above instead.",
  },
  overviewTitle: { vi: "Tổng quan", en: "Overview" },
  versionLabel: { vi: "Phiên bản", en: "Version" },
  serversLabel: { vi: "Servers", en: "Servers" },
  noServers: { vi: "Spec không khai báo server nào.", en: "The spec declares no servers." },
  endpointsTitle: { vi: "Endpoints", en: "Endpoints" },
  endpointsSubtitle: {
    vi: "Bấm vào một endpoint để xem chi tiết",
    en: "Click an endpoint to see its details",
  },
  searchPlaceholder: { vi: "Tìm theo path, summary, operationId…", en: "Search path, summary, operationId…" },
  searchLabel: { vi: "Tìm kiếm endpoint", en: "Search endpoints" },
  noResults: { vi: "Không có endpoint nào khớp bộ lọc.", en: "No endpoints match the current filters." },
  cappedNotice: {
    vi: "Hiển thị 100/{total} endpoint trong tag này — dùng tìm kiếm để thu hẹp.",
    en: "Showing 100 of {total} endpoints in this tag — use search to narrow down.",
  },
  warningsTitle: { vi: "Cảnh báo", en: "Warnings" },
  detailParameters: { vi: "Tham số", en: "Parameters" },
  colName: { vi: "Tên", en: "Name" },
  colIn: { vi: "Vị trí", en: "In" },
  colType: { vi: "Kiểu", en: "Type" },
  colRequired: { vi: "Bắt buộc", en: "Required" },
  colDescription: { vi: "Mô tả", en: "Description" },
  required: { vi: "bắt buộc", en: "required" },
  requestBodyTitle: { vi: "Request body", en: "Request body" },
  responsesTitle: { vi: "Responses", en: "Responses" },
  exampleLabel: { vi: "Ví dụ", en: "Example" },
  showExample: { vi: "Hiện ví dụ", en: "Show example" },
  hideExample: { vi: "Ẩn ví dụ", en: "Hide example" },
  sampleRequestTitle: { vi: "Request mẫu", en: "Sample request" },
  copy: { vi: "Sao chép", en: "Copy" },
  emptyHint: {
    vi: "Dán spec, tải từ URL hoặc bấm “Spec mẫu” để bắt đầu.",
    en: "Paste a spec, load it from a URL, or press “Sample spec” to get started.",
  },
  noParams: { vi: "Endpoint không có tham số.", en: "This endpoint has no parameters." },
} satisfies Record<string, Localized>;

// ---------------------------------------------------------------------------
// Method / status styling
// ---------------------------------------------------------------------------

const METHOD_CLASSES: Record<string, string> = {
  get: "text-success bg-success/10",
  post: "text-accent bg-accent/10",
  put: "text-warning bg-warning/10",
  patch: "text-primary bg-primary/10",
  delete: "text-danger bg-danger/10",
  head: "text-muted-foreground bg-muted",
  options: "text-muted-foreground bg-muted",
};

function MethodBadge({ method, className }: { method: string; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex w-16 shrink-0 items-center justify-center rounded-md px-1.5 py-0.5 font-mono text-[11px] font-semibold uppercase",
        METHOD_CLASSES[method] ?? "text-muted-foreground bg-muted",
        className,
      )}
    >
      {method}
    </span>
  );
}

function statusClasses(status: string): string {
  if (status.startsWith("2")) return "text-success bg-success/10";
  if (status.startsWith("3")) return "text-accent bg-accent/10";
  if (status.startsWith("4")) return "text-warning bg-warning/10";
  if (status.startsWith("5")) return "text-danger bg-danger/10";
  return "text-muted-foreground bg-muted";
}

// ---------------------------------------------------------------------------
// Building blocks
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

/** Collapsible generated example (JSON) with a copy button. */
function CollapsibleExample({ value, defaultOpen = false }: { value: unknown; defaultOpen?: boolean }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(defaultOpen);
  const json = useMemo(() => JSON.stringify(value, null, 2) ?? "null", [value]);
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
        >
          {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
          {open ? t(M.hideExample) : t(M.showExample)}
        </button>
        {open ? <CopyButton text={json} label={t(M.copy)} /> : null}
      </div>
      {open ? <CodeBlock code={json} /> : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Detail panel
// ---------------------------------------------------------------------------

function DetailPanel({ view, op }: { view: SpecView; op: OperationView }) {
  const { t } = useI18n();
  const [reqTab, setReqTab] = useState<"curl" | "fetch">("curl");

  const bodyExample = useMemo(() => {
    if (!op.requestBody) return undefined;
    if (op.requestBody.example !== undefined) return op.requestBody.example;
    if (op.requestBody.schema !== undefined) return exampleFromSchema(view.raw, op.requestBody.schema);
    return undefined;
  }, [view, op]);

  const sample = useMemo(() => buildSampleRequest(view, op), [view, op]);

  const responseExample = (response: ResponseView): unknown => {
    if (response.example !== undefined) return response.example;
    if (response.schema !== undefined) return exampleFromSchema(view.raw, response.schema);
    return undefined;
  };

  return (
    <Card>
      <CardHeader
        title={
          <span className="flex flex-wrap items-center gap-2">
            <MethodBadge method={op.method} />
            <span className="break-all font-mono">{op.path}</span>
          </span>
        }
        subtitle={
          <span>
            {op.summary}
            {op.operationId ? (
              <span className="ml-2 font-mono text-[11px] text-muted-foreground">({op.operationId})</span>
            ) : null}
          </span>
        }
      />
      <CardBody className="space-y-5">
        {op.description && op.description !== op.summary ? (
          <p className="whitespace-pre-wrap text-sm text-muted-foreground">{op.description}</p>
        ) : null}

        {/* Parameters */}
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {t(M.detailParameters)}
          </p>
          {op.parameters.length === 0 ? (
            <p className="text-xs text-muted-foreground">{t(M.noParams)}</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full min-w-[32rem] text-left text-xs">
                <thead className="bg-muted/60 text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 font-medium">{t(M.colName)}</th>
                    <th className="px-3 py-2 font-medium">{t(M.colIn)}</th>
                    <th className="px-3 py-2 font-medium">{t(M.colType)}</th>
                    <th className="px-3 py-2 font-medium">{t(M.colRequired)}</th>
                    <th className="px-3 py-2 font-medium">{t(M.colDescription)}</th>
                  </tr>
                </thead>
                <tbody>
                  {op.parameters.map((param, idx) => (
                    <tr key={`${param.location}-${param.name}-${idx}`} className="border-t border-border">
                      <td className="px-3 py-2 font-mono text-foreground">{param.name}</td>
                      <td className="px-3 py-2">
                        <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px]">{param.location}</span>
                      </td>
                      <td className="px-3 py-2 font-mono text-muted-foreground">{param.type}</td>
                      <td className="px-3 py-2">
                        {param.required ? (
                          <span className="rounded bg-danger/10 px-1.5 py-0.5 text-[11px] font-medium text-danger">
                            {t(M.required)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">{param.description ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Request body */}
        {op.requestBody ? (
          <div className="space-y-2">
            <p className="flex flex-wrap items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {t(M.requestBodyTitle)}
              <span className="rounded bg-primary/10 px-1.5 py-0.5 font-mono text-[11px] normal-case text-primary">
                {op.requestBody.contentType}
              </span>
              {op.requestBody.required ? (
                <span className="rounded bg-danger/10 px-1.5 py-0.5 text-[11px] font-medium normal-case text-danger">
                  {t(M.required)}
                </span>
              ) : null}
            </p>
            {bodyExample !== undefined ? <CollapsibleExample value={bodyExample} defaultOpen /> : null}
          </div>
        ) : null}

        {/* Responses */}
        {op.responses.length > 0 ? (
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{t(M.responsesTitle)}</p>
            <div className="space-y-2">
              {op.responses.map((response) => {
                const example = responseExample(response);
                return (
                  <div key={response.status} className="rounded-lg border border-border px-3 py-2.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={cn(
                          "rounded-md px-1.5 py-0.5 font-mono text-[11px] font-semibold",
                          statusClasses(response.status),
                        )}
                      >
                        {response.status}
                      </span>
                      <span className="text-xs text-muted-foreground">{response.description || "—"}</span>
                      {response.contentType ? (
                        <span className="font-mono text-[11px] text-muted-foreground">{response.contentType}</span>
                      ) : null}
                    </div>
                    {example !== undefined ? (
                      <div className="mt-2">
                        <CollapsibleExample value={example} />
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}

        {/* Sample request */}
        <div className="space-y-3">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {t(M.sampleRequestTitle)}
          </p>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Tabs
              items={[
                { value: "curl", label: "cURL" },
                { value: "fetch", label: "fetch" },
              ]}
              value={reqTab}
              onChange={setReqTab}
              size="sm"
            />
            <CopyButton text={reqTab === "curl" ? sample.curl : sample.fetch} label={t(M.copy)} />
          </div>
          <CodeBlock code={reqTab === "curl" ? sample.curl : sample.fetch} />
        </div>
      </CardBody>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Tool
// ---------------------------------------------------------------------------

const RENDER_CAP = 100;

export default function OpenApiViewerTool() {
  const { t } = useI18n();
  const [specText, setSpecText] = useState("");
  const [view, setView] = useState<SpecView | null>(null);
  const [parseError, setParseError] = useState<Localized | null>(null);
  const [urlInput, setUrlInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<Localized | null>(null);
  const [search, setSearch] = useState("");
  const [methodFilter, setMethodFilter] = useState<string[]>([]);
  const [expandedOverrides, setExpandedOverrides] = useState<Record<string, boolean>>({});
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  // Debounced live parse (~300ms).
  useEffect(() => {
    const timer = setTimeout(() => {
      const outcome = parseSpec(specText);
      setView(outcome.view);
      setParseError(outcome.error);
      setExpandedOverrides({});
      setSelectedKey((prev) => {
        if (!prev || !outcome.view) return null;
        const stillExists = outcome.view.tags.some((g) => g.operations.some((o) => o.key === prev));
        return stillExists ? prev : null;
      });
    }, 300);
    return () => clearTimeout(timer);
  }, [specText]);

  const loadFromUrl = async () => {
    const url = urlInput.trim();
    if (!url || loading) return;
    setLoading(true);
    setLoadError(null);
    try {
      const response = await fetch(url, { headers: { Accept: "application/json, text/yaml, text/plain, */*" } });
      if (!response.ok) throw new Error(String(response.status));
      const text = await response.text();
      setSpecText(text);
    } catch {
      setLoadError(M.loadError);
    } finally {
      setLoading(false);
    }
  };

  const filtering = search.trim().length > 0 || methodFilter.length > 0;

  const filteredTags = useMemo(() => {
    if (!view) return [];
    const q = search.trim().toLowerCase();
    return view.tags
      .map((group) => ({
        ...group,
        operations: group.operations.filter((op) => {
          if (methodFilter.length > 0 && !methodFilter.includes(op.method)) return false;
          if (!q) return true;
          return (
            op.path.toLowerCase().includes(q) ||
            (op.summary ?? "").toLowerCase().includes(q) ||
            (op.operationId ?? "").toLowerCase().includes(q)
          );
        }),
      }))
      .filter((group) => group.operations.length > 0);
  }, [view, search, methodFilter]);

  const selectedOp = useMemo(() => {
    if (!view || !selectedKey) return null;
    for (const group of view.tags) {
      const found = group.operations.find((op) => op.key === selectedKey);
      if (found) return found;
    }
    return null;
  }, [view, selectedKey]);

  const defaultExpanded = view !== null && view.tags.length <= 3;

  const isExpanded = (tagName: string): boolean => {
    if (filtering) return true;
    return expandedOverrides[tagName] ?? defaultExpanded;
  };

  const toggleTag = (tagName: string) => {
    const current = isExpanded(tagName);
    setExpandedOverrides((prev) => ({ ...prev, [tagName]: !current }));
  };

  const toggleMethod = (method: string) => {
    setMethodFilter((prev) => (prev.includes(method) ? prev.filter((m) => m !== method) : [...prev, method]));
  };

  return (
    <div className="space-y-6">
      {/* ---- Input ---- */}
      <Card>
        <CardHeader
          title={t(M.inputTitle)}
          subtitle={t(M.inputSubtitle)}
          actions={
            specText ? (
              <Button variant="ghost" size="sm" onClick={() => setSpecText("")}>
                {t(M.clear)}
              </Button>
            ) : undefined
          }
        />
        <CardBody className="space-y-3">
          <TextArea
            aria-label={t(M.inputTitle)}
            rows={8}
            value={specText}
            onChange={(e) => setSpecText(e.target.value)}
            placeholder={t(M.pastePlaceholder)}
            spellCheck={false}
          />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto_auto] sm:items-end">
            <Field label={t(M.loadFromUrl)} htmlFor="oav-url">
              <TextInput
                id="oav-url"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder={t(M.urlPlaceholder)}
                className="font-mono text-xs"
                autoComplete="off"
                spellCheck={false}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void loadFromUrl();
                }}
              />
            </Field>
            <Button variant="outline" onClick={() => void loadFromUrl()} disabled={loading || !urlInput.trim()}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {t(M.loadBtn)}
            </Button>
            <Button variant="outline" onClick={() => setSpecText(SAMPLE_SPEC)}>
              <FileJson className="h-4 w-4" />
              {t(M.sampleBtn)}
            </Button>
          </div>
          {loadError ? <p className="text-sm text-danger">{t(loadError)}</p> : null}
          {parseError ? <p className="text-sm text-danger">{t(parseError)}</p> : null}
          {!view && !parseError && !specText.trim() ? (
            <p className="text-xs text-muted-foreground">{t(M.emptyHint)}</p>
          ) : null}
        </CardBody>
      </Card>

      {view ? (
        <>
          {/* ---- Overview ---- */}
          <Card>
            <CardHeader
              title={view.title}
              subtitle={
                <span className="flex flex-wrap items-center gap-2">
                  <span className="rounded bg-primary/10 px-1.5 py-0.5 font-mono text-[11px] text-primary">
                    {view.specVersion}
                  </span>
                  <span>
                    {t(M.versionLabel)}: <span className="font-mono">{view.version}</span>
                  </span>
                </span>
              }
            />
            <CardBody className="space-y-3">
              {view.description ? (
                <p className="line-clamp-3 whitespace-pre-wrap text-sm text-muted-foreground" title={view.description}>
                  {view.description}
                </p>
              ) : null}
              <div className="space-y-1.5">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  {t(M.serversLabel)}
                </p>
                {view.servers.length === 0 ? (
                  <p className="text-xs text-muted-foreground">{t(M.noServers)}</p>
                ) : (
                  <ul className="space-y-1">
                    {view.servers.map((server) => (
                      <li key={server} className="flex items-center gap-2 font-mono text-xs text-foreground">
                        <Server className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        <span className="break-all">{server}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <WarningList warnings={view.warnings} />
            </CardBody>
          </Card>

          {/* ---- Endpoints browser ---- */}
          <Card>
            <CardHeader
              title={`${t(M.endpointsTitle)} (${view.operationCount})`}
              subtitle={t(M.endpointsSubtitle)}
            />
            <CardBody className="space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="relative flex-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <TextInput
                    aria-label={t(M.searchLabel)}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder={t(M.searchPlaceholder)}
                    className="pl-9"
                    autoComplete="off"
                    spellCheck={false}
                  />
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  {FILTERABLE_METHODS.map((method) => {
                    const active = methodFilter.includes(method);
                    return (
                      <button
                        key={method}
                        type="button"
                        aria-pressed={active}
                        onClick={() => toggleMethod(method)}
                        className={cn(
                          "rounded-full border px-2.5 py-1 font-mono text-[11px] font-semibold uppercase transition-colors",
                          active
                            ? cn("border-transparent", METHOD_CLASSES[method])
                            : "border-border text-muted-foreground hover:text-foreground",
                        )}
                      >
                        {method}
                      </button>
                    );
                  })}
                </div>
              </div>

              {filteredTags.length === 0 ? (
                <p className="py-4 text-center text-sm text-muted-foreground">{t(M.noResults)}</p>
              ) : (
                <div className="space-y-2">
                  {filteredTags.map((group) => {
                    const expanded = isExpanded(group.name);
                    const shown = group.operations.slice(0, RENDER_CAP);
                    return (
                      <div key={group.name} className="overflow-hidden rounded-lg border border-border">
                        <button
                          type="button"
                          onClick={() => toggleTag(group.name)}
                          className="flex w-full items-center gap-2 bg-muted/60 px-3 py-2.5 text-left transition-colors hover:bg-muted"
                        >
                          {expanded ? (
                            <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                          )}
                          <span className="text-sm font-semibold">{group.name}</span>
                          {group.description ? (
                            <span className="hidden truncate text-xs text-muted-foreground sm:inline">
                              {group.description}
                            </span>
                          ) : null}
                          <span className="ml-auto shrink-0 rounded-full bg-primary/10 px-2 py-0.5 font-mono text-[11px] text-primary">
                            {group.operations.length}
                          </span>
                        </button>
                        {expanded ? (
                          <ul>
                            {shown.map((op) => (
                              <li key={op.key} className="border-t border-border">
                                <button
                                  type="button"
                                  onClick={() => setSelectedKey(op.key)}
                                  className={cn(
                                    "flex w-full flex-wrap items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-muted/60",
                                    selectedKey === op.key && "bg-primary/10",
                                  )}
                                >
                                  <MethodBadge method={op.method} />
                                  <span className="break-all font-mono text-xs text-foreground">{op.path}</span>
                                  {op.summary ? (
                                    <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                                      {op.summary}
                                    </span>
                                  ) : null}
                                </button>
                              </li>
                            ))}
                            {group.operations.length > RENDER_CAP ? (
                              <li className="border-t border-border px-3 py-2 text-xs text-warning">
                                {t(M.cappedNotice).replace("{total}", String(group.operations.length))}
                              </li>
                            ) : null}
                          </ul>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardBody>
          </Card>

          {/* ---- Detail panel ---- */}
          {selectedOp ? <DetailPanel view={view} op={selectedOp} /> : null}
        </>
      ) : null}
    </div>
  );
}
