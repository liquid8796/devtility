import { NextResponse } from "next/server";

import { isBlobConfigured, loadSnippet } from "@/server/snippets/blob-store";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  if (!isBlobConfigured()) {
    return NextResponse.json({ error: "Blob Store chưa được cấu hình" }, { status: 503 });
  }

  const { id } = await params;
  const snippet = await loadSnippet(id);
  if (!snippet) {
    return NextResponse.json({ error: "Không tìm thấy snippet" }, { status: 404 });
  }
  return NextResponse.json(snippet, {
    headers: { "Cache-Control": "public, s-maxage=31536000, immutable" },
  });
}
