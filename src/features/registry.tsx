"use client";

import dynamic from "next/dynamic";
import type { ComponentType } from "react";

/**
 * Maps a tool slug to its (lazily loaded) feature component.
 * Tools run fully client-side; ssr is disabled so browser APIs
 * (timezone, clipboard, workers…) are safe to use during render.
 */

function ToolSkeleton() {
  return (
    <div className="card-surface animate-pulse space-y-4 p-6">
      <div className="h-4 w-1/3 rounded bg-muted" />
      <div className="h-10 rounded bg-muted" />
      <div className="h-10 w-2/3 rounded bg-muted" />
      <div className="h-32 rounded bg-muted" />
    </div>
  );
}

const loading = () => <ToolSkeleton />;

const FEATURES: Record<string, ComponentType> = {
  timezone: dynamic(() => import("@/features/timezone/timezone-tool"), { ssr: false, loading }),
  epoch: dynamic(() => import("@/features/epoch/epoch-tool"), { ssr: false, loading }),
  currency: dynamic(() => import("@/features/currency/currency-tool"), { ssr: false, loading }),
  "number-base": dynamic(() => import("@/features/number-base/number-base-tool"), { ssr: false, loading }),
  units: dynamic(() => import("@/features/units/units-tool"), { ssr: false, loading }),
  calculator: dynamic(() => import("@/features/calculator/calculator-tool"), { ssr: false, loading }),
  "age-calculator": dynamic(() => import("@/features/age-calculator/age-calculator-tool"), { ssr: false, loading }),
  "compound-interest": dynamic(() => import("@/features/compound-interest/compound-interest-tool"), { ssr: false, loading }),
  salary: dynamic(() => import("@/features/salary/salary-tool"), { ssr: false, loading }),
  "lunar-calendar": dynamic(() => import("@/features/lunar-calendar/lunar-calendar-tool"), { ssr: false, loading }),
  "code-editor": dynamic(() => import("@/features/code-editor/code-editor-tool"), { ssr: false, loading }),
  "json-toolkit": dynamic(() => import("@/features/json-toolkit/json-toolkit-tool"), { ssr: false, loading }),
  "json-converter": dynamic(() => import("@/features/json-converter/json-converter-tool"), { ssr: false, loading }),
  jwt: dynamic(() => import("@/features/jwt/jwt-tool"), { ssr: false, loading }),
  "base64-url": dynamic(() => import("@/features/base64-url/base64-url-tool"), { ssr: false, loading }),
  uuid: dynamic(() => import("@/features/uuid/uuid-tool"), { ssr: false, loading }),
  "regex-tester": dynamic(() => import("@/features/regex-tester/regex-tester-tool"), { ssr: false, loading }),
  diff: dynamic(() => import("@/features/diff/diff-tool"), { ssr: false, loading }),
  cron: dynamic(() => import("@/features/cron/cron-tool"), { ssr: false, loading }),
  hash: dynamic(() => import("@/features/hash/hash-tool"), { ssr: false, loading }),
  "sql-formatter": dynamic(() => import("@/features/sql-formatter/sql-formatter-tool"), { ssr: false, loading }),
  "curl-converter": dynamic(() => import("@/features/curl-converter/curl-converter-tool"), { ssr: false, loading }),
  "openapi-viewer": dynamic(() => import("@/features/openapi-viewer/openapi-viewer-tool"), { ssr: false, loading }),
  traffic: dynamic(() => import("@/features/traffic/traffic-tool"), { ssr: false, loading }),
};

export function ToolRenderer({ slug }: { slug: string }) {
  const Feature = FEATURES[slug];
  if (!Feature) {
    return (
      <div className="card-surface p-8 text-center text-sm text-muted-foreground">
        Công cụ này chưa được đăng ký trong <code className="font-mono">src/features/registry.tsx</code>.
      </div>
    );
  }
  return <Feature />;
}
