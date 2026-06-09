import { IST_OFFSET_MINUTES } from "./config";

// All "days" are anchored to IST (Asia/Kolkata) so a roll-call at 7 PM local
// always belongs to the correct calendar day regardless of server timezone.

export function istNow(): Date {
  return new Date(Date.now() + IST_OFFSET_MINUTES * 60_000);
}

/** Returns YYYY-MM-DD for the current IST day. */
export function todayKey(): string {
  return istNow().toISOString().slice(0, 10);
}

/** Validates / normalises an arbitrary date string to a YYYY-MM-DD day key. */
export function toDayKey(input?: string | null): string {
  if (!input) return todayKey();
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(input.trim());
  return m ? m[0] : todayKey();
}

/** Adds n days to a YYYY-MM-DD key, returns a new key. */
export function addDays(dayKey: string, n: number): string {
  const d = new Date(dayKey + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Human display, e.g. "29 May 2026". */
export function formatDay(dayKey: string): string {
  const d = new Date(dayKey + "T00:00:00Z");
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** Human time in IST, e.g. "07:14:02 PM". */
export function formatIstTime(value: Date | string | null | undefined): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  return d.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
    timeZone: "Asia/Kolkata",
  });
}

export function formatIstDateTime(value: Date | string | null | undefined): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  return d.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
    timeZone: "Asia/Kolkata",
  });
}
