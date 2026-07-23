import { TOOLS } from "@/lib/registry/tools";
import { toolPath } from "@/lib/registry/types";
import { getAnalyticsRepository } from "@/server/analytics";

export const runtime = "nodejs";

// Only real pages may be tracked — an open allowlist would let anyone mint
// unbounded analytics keys.
const VALID_PATHS = new Set<string>(["/", ...TOOLS.map((tool) => toolPath(tool))]);

/**
 * Page-view beacon endpoint. Intentionally forgiving: analytics failures
 * must never surface to the user, so every branch returns 204.
 */
export async function POST(request: Request): Promise<Response> {
  try {
    const body = (await request.json()) as { path?: unknown };
    const path = typeof body.path === "string" ? body.path : "";

    if (VALID_PATHS.has(path)) {
      await getAnalyticsRepository().track({ path });
    }
  } catch {
    // swallow — see above
  }
  return new Response(null, { status: 204 });
}
