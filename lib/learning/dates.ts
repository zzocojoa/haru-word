import { type Kind } from "./model.ts";

export function today(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function weekStart(date: string): string {
  const d = new Date(date + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}

export function periodKey(kind: Kind, date: string): string {
  return kind === "monthly"
    ? date.slice(0, 7)
    : kind === "weekly"
      ? weekStart(date)
      : date;
}
