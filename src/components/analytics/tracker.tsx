"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

/**
 * Fire-and-forget page-view beacon. Sends one event per client-side navigation.
 * Failures are intentionally swallowed — analytics must never break the UX.
 */
export function AnalyticsTracker() {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname) return;
    const payload = JSON.stringify({ path: pathname });
    try {
      const sent = navigator.sendBeacon?.(
        "/api/track",
        new Blob([payload], { type: "application/json" }),
      );
      if (!sent) {
        void fetch("/api/track", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: payload,
          keepalive: true,
        }).catch(() => undefined);
      }
    } catch {
      // ignore
    }
  }, [pathname]);

  return null;
}
