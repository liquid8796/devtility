/**
 * IANA time-zone list helpers shared by the timezone & epoch tools.
 * Uses Intl.supportedValuesOf when available, otherwise a curated fallback.
 */

export const FALLBACK_ZONES: readonly string[] = [
  "UTC",
  "Asia/Ho_Chi_Minh",
  "Asia/Bangkok",
  "Asia/Singapore",
  "Asia/Jakarta",
  "Asia/Manila",
  "Asia/Hong_Kong",
  "Asia/Shanghai",
  "Asia/Taipei",
  "Asia/Tokyo",
  "Asia/Seoul",
  "Asia/Kolkata",
  "Asia/Dubai",
  "Asia/Riyadh",
  "Europe/Moscow",
  "Europe/Istanbul",
  "Europe/Athens",
  "Europe/Berlin",
  "Europe/Paris",
  "Europe/Madrid",
  "Europe/Amsterdam",
  "Europe/London",
  "America/Sao_Paulo",
  "America/New_York",
  "America/Toronto",
  "America/Chicago",
  "America/Mexico_City",
  "America/Denver",
  "America/Los_Angeles",
  "America/Vancouver",
  "Pacific/Auckland",
  "Australia/Sydney",
  "Australia/Melbourne",
  "Australia/Perth",
];

/** Returns the full IANA zone list, guaranteed to contain UTC. */
export function getTimeZones(): string[] {
  let zones: string[];
  try {
    zones = Intl.supportedValuesOf("timeZone");
    if (!Array.isArray(zones) || zones.length === 0) zones = [...FALLBACK_ZONES];
  } catch {
    zones = [...FALLBACK_ZONES];
  }
  if (!zones.includes("UTC")) zones = ["UTC", ...zones];
  return zones;
}

/** Human-friendly zone label: underscores become spaces. */
export function zoneLabel(zone: string): string {
  return zone.replace(/_/g, " ");
}
