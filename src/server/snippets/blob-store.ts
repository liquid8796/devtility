import { head, put } from "@vercel/blob";

/**
 * Code-snippet sharing backed by Vercel Blob (fast object storage).
 * Snippets are immutable JSON documents at a deterministic pathname,
 * so retrieval only needs the id. Gracefully disabled when the
 * BLOB_READ_WRITE_TOKEN env is absent (local dev without storage).
 */

export interface Snippet {
  language: string;
  version?: string;
  code: string;
  createdAt: string;
}

const MAX_CODE_BYTES = 128 * 1024;
const ID_PATTERN = /^[a-f0-9-]{36}$/;

export function isBlobConfigured(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

function pathFor(id: string): string {
  return `snippets/${id}.json`;
}

export async function saveSnippet(snippet: Omit<Snippet, "createdAt">): Promise<{ id: string }> {
  if (new TextEncoder().encode(snippet.code).length > MAX_CODE_BYTES) {
    throw new Error("Code vượt quá giới hạn 128 KB");
  }
  const id = crypto.randomUUID();
  const document: Snippet = { ...snippet, createdAt: new Date().toISOString() };
  await put(pathFor(id), JSON.stringify(document), {
    access: "public",
    contentType: "application/json",
    addRandomSuffix: false,
  });
  return { id };
}

export async function loadSnippet(id: string): Promise<Snippet | null> {
  if (!ID_PATTERN.test(id)) return null;
  try {
    const meta = await head(pathFor(id));
    const res = await fetch(meta.url, { cache: "force-cache" });
    if (!res.ok) return null;
    return (await res.json()) as Snippet;
  } catch {
    // head() throws when the blob does not exist
    return null;
  }
}
