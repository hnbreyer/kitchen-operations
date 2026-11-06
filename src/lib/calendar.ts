import { businessTimezone } from "./config";
export function dateKey(date: Date, timezone = businessTimezone) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (key: string) => parts.find((p) => p.type === key)!.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}
export function businessDate(value: string, timezone = businessTimezone) {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    value < "1900-01-01" ||
    value > "2100-12-31"
  )
    throw new Error("Enter a valid date between 1900 and 2100.");
  const target = new Date(`${value}T12:00:00Z`);
  if (
    !Number.isFinite(target.getTime()) ||
    target.toISOString().slice(0, 10) !== value
  )
    throw new Error("Enter a valid calendar date.");
  // Store business-local noon as UTC. Noon avoids ambiguous midnight DST transitions.
  let instant = target;
  for (let i = 0; i < 3; i++) {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    }).formatToParts(instant);
    const get = (key: string) => parts.find((p) => p.type === key)!.value;
    const localAsUTC = new Date(
      `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}:${get("second")}Z`,
    );
    instant = new Date(
      instant.getTime() + target.getTime() - localAsUTC.getTime(),
    );
  }
  if (dateKey(instant, timezone) !== value)
    throw new Error("This date is unavailable in the business timezone.");
  return instant;
}
export function parseMonth(value: unknown, now = new Date()) {
  if (
    typeof value === "string" &&
    /^(19\d{2}|20\d{2}|2100)-(0[1-9]|1[0-2])$/.test(value)
  )
    return value;
  return dateKey(now).slice(0, 7);
}
export function adjacentMonth(month: string, offset: number) {
  const d = new Date(`${month}-01T12:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + offset);
  return d.toISOString().slice(0, 7);
}
export function calendarDays(month: string) {
  const first = new Date(`${month}-01T12:00:00Z`);
  const last = new Date(first);
  last.setUTCMonth(last.getUTCMonth() + 1);
  last.setUTCDate(0);
  const days = Array.from(
    { length: last.getUTCDate() },
    (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`,
  );
  return { offset: (first.getUTCDay() + 6) % 7, days };
}
export function operationsOnDate<T extends { startDate: Date; endDate: Date }>(
  operations: T[],
  day: string,
) {
  return operations.filter(
    (o) => dateKey(o.startDate) <= day && dateKey(o.endDate) >= day,
  );
}
