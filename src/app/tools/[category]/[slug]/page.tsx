import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ToolPage } from "@/components/ui/tool-page";
import { getTool, TOOLS } from "@/lib/registry/tools";
import { ToolRenderer } from "@/features/registry";

interface Params {
  category: string;
  slug: string;
}

export function generateStaticParams(): Params[] {
  return TOOLS.map((tool) => ({ category: tool.category, slug: tool.slug }));
}

export const dynamicParams = false;

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { category, slug } = await params;
  const tool = getTool(category, slug);
  if (!tool) return {};
  return {
    title: tool.name,
    description: tool.description,
    keywords: [...tool.keywords],
  };
}

export default async function ToolRoute({ params }: { params: Promise<Params> }) {
  const { category, slug } = await params;
  const tool = getTool(category, slug);
  if (!tool) notFound();

  return (
    <ToolPage tool={tool}>
      <ToolRenderer slug={tool.slug} />
    </ToolPage>
  );
}
