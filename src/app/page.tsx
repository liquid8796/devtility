import { ArrowRight, Sparkles } from "lucide-react";
import Link from "next/link";

import { CATEGORIES, getToolsByCategory, SITE, TOOLS } from "@/lib/registry/tools";
import { toolPath } from "@/lib/registry/types";

export default function HomePage() {
  return (
    <div className="space-y-12">
      {/* ---- Hero ---- */}
      <section className="animate-fade-up pt-6 text-center sm:pt-12">
        <p className="mx-auto mb-4 inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 font-mono text-xs text-muted-foreground">
          <Sparkles className="h-3.5 w-3.5 text-accent" />
          {TOOLS.length} công cụ · miễn phí · open-source
        </p>
        <h1 className="mx-auto max-w-3xl text-3xl font-extrabold leading-tight tracking-tight sm:text-5xl">
          Bộ công cụ <span className="text-gradient">tiện ích</span> cho lập trình viên
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-sm text-muted-foreground sm:text-base">
          {SITE.description}
        </p>
      </section>

      {/* ---- Categories ---- */}
      {CATEGORIES.map((category, i) => {
        const tools = getToolsByCategory(category.id);
        if (tools.length === 0) return null;

        return (
          <section key={category.id} className={`animate-fade-up-delay-${Math.min(i + 1, 3)}`}>
            <div className="mb-4 flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-card text-primary">
                <category.icon className="h-4.5 w-4.5" />
              </span>
              <div>
                <h2 className="text-lg font-bold tracking-tight">{category.name}</h2>
                <p className="text-xs text-muted-foreground">{category.tagline}</p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {tools.map((tool) => (
                <Link
                  key={tool.slug}
                  href={toolPath(tool)}
                  className="card-surface card-hover group flex flex-col p-5"
                >
                  <div className="mb-3 flex items-center justify-between">
                    <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <tool.icon className="h-5 w-5" />
                    </span>
                    <ArrowRight className="h-4 w-4 -translate-x-1 text-muted-foreground/0 transition-all group-hover:translate-x-0 group-hover:text-primary" />
                  </div>
                  <h3 className="font-semibold">
                    {tool.name}
                    {tool.status === "beta" ? (
                      <span className="ml-2 rounded-full bg-accent/15 px-1.5 py-0.5 align-middle text-[9px] font-semibold uppercase text-accent">
                        Beta
                      </span>
                    ) : null}
                  </h3>
                  <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                    {tool.description}
                  </p>
                </Link>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
