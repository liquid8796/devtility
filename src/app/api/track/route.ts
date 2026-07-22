import { getAnalyticsRepository } from "@/server/analytics";

export const runtime = "nodejs";

/**
 * Page-view beacon endpoint. Intentionally forgiving: analytics failures
 * must never surface to the user, so every branch returns 204.
 */
export async function POST(request: Request): Promise<Response> {
  try {
    const body = (await request.json()) as { path?: unknown };
    const path = typeof body.path === "string" ? body.path : "";

    // Only count real pages (guard against junk/api/static paths)
    if (path.startsWith("/") && !path.startsWith("/api") && path.length <= 200) {
      await getAnalyticsRepository().track({ path });
    }
  } catch {
    // swallow — see above
  }
  return new Response(null, { status: 204 });
}
