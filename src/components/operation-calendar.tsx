import Link from "next/link";
import type { Operation, Location, OperationType } from "@prisma/client";
import {
  adjacentMonth,
  calendarDays,
  dateKey,
  operationsOnDate,
} from "@/lib/calendar";
import { statusLabels, typeLabels } from "@/lib/domain";
export function operationsUrl(
  view: string,
  type?: OperationType,
  month?: string,
) {
  const params = new URLSearchParams();
  if (view === "calendar") params.set("view", view);
  if (type) params.set("type", type);
  if (month) params.set("month", month);
  return `/operations${params.size ? `?${params}` : ""}`;
}
export function OperationCalendar({
  operations,
  month,
  type,
}: {
  operations: (Operation & { location: Location })[];
  month: string;
  type?: OperationType;
}) {
  const { offset, days } = calendarDays(month);
  const label = new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${month}-01T12:00:00Z`));
  const today = dateKey(new Date());
  const visible = operations.filter(
    (o) =>
      dateKey(o.startDate) <= days.at(-1)! && dateKey(o.endDate) >= days[0],
  );
  return (
    <section className="panel">
      <div className="section-heading calendar-heading">
        <div>
          <h2>{label}</h2>
          <p>
            {visible.length} operations scheduled this month · inclusive date
            ranges
          </p>
        </div>
        <div className="calendar-navigation">
          {month > "1900-01" && (
            <Link
              aria-label="Previous month"
              className="secondary-button"
              href={operationsUrl("calendar", type, adjacentMonth(month, -1))}
            >
              ←
            </Link>
          )}
          <Link
            className="secondary-button"
            href={operationsUrl("calendar", type, today.slice(0, 7))}
          >
            This month
          </Link>
          {month < "2100-12" && (
            <Link
              aria-label="Next month"
              className="secondary-button"
              href={operationsUrl("calendar", type, adjacentMonth(month, 1))}
            >
              →
            </Link>
          )}
        </div>
      </div>
      <div className="calendar-weekdays" aria-hidden="true">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
          <span key={d}>{d}</span>
        ))}
      </div>
      <div className="calendar-grid" aria-label={label}>
        {Array.from({ length: offset }, (_, i) => (
          <div
            className="calendar-spacer"
            key={`spacer-${i}`}
            aria-hidden="true"
          />
        ))}
        {days.map((day) => {
          const daily = operationsOnDate(operations, day);
          return (
            <section
              key={day}
              className={`calendar-day ${day === today ? "is-today" : ""} ${!daily.length ? "no-events" : ""}`}
              aria-label={day}
            >
              <h3>
                <time dateTime={day}>
                  {Number(day.slice(-2))}
                  <span className="mobile-day">
                    {" "}
                    {new Intl.DateTimeFormat("en-US", {
                      weekday: "short",
                      timeZone: "UTC",
                    }).format(new Date(`${day}T12:00:00Z`))}
                  </span>
                </time>
                {day === today && <small>Today</small>}
              </h3>
              {daily.map((o) => (
                <Link
                  key={o.id}
                  className={`calendar-event type-${o.type.toLowerCase()}`}
                  href={`/operations/${o.id}`}
                >
                  <strong>{o.name}</strong>
                  <span>
                    {typeLabels[o.type]} · {statusLabels[o.status]}
                  </span>
                  {dateKey(o.startDate) !== dateKey(o.endDate) && (
                    <small>
                      {day > dateKey(o.startDate) ? "← Continued" : "Starts"}
                      {day < dateKey(o.endDate) ? " · continues →" : " · ends"}
                    </small>
                  )}
                </Link>
              ))}
              <span className="mobile-empty">No operations</span>
            </section>
          );
        })}
      </div>
      {!visible.length && (
        <p className="empty">No operations match this month and filter.</p>
      )}
    </section>
  );
}
