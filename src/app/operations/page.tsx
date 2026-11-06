import Link from "next/link";
import { getOperations } from "@/lib/operations";
import { operationTypes, parseOperationType, typeLabels } from "@/lib/domain";
import { OperationTable } from "@/components/operation-table";
import {
  OperationCalendar,
  operationsUrl,
} from "@/components/operation-calendar";
import { parseMonth } from "@/lib/calendar";
export const dynamic = "force-dynamic";
export default async function Operations({
  searchParams,
}: {
  searchParams: Promise<{
    type?: string | string[];
    view?: string;
    month?: string;
    notice?: string;
  }>;
}) {
  const params = await searchParams;
  const type = parseOperationType(params.type);
  const view = params.view === "calendar" ? "calendar" : "list";
  const month = parseMonth(params.month);
  const { all } = await getOperations(type);
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">PLAN THE WORK AHEAD</p>
          <h1>Operations</h1>
          <p>Retreats, city service, and private events in one place.</p>
        </div>
        <Link href="/operations/new" className="button">
          New operation
        </Link>
      </div>
      {params.notice === "deleted" && (
        <p role="status" className="success-message">
          Operation deleted. Other records were preserved.
        </p>
      )}
      <div className="operations-toolbar">
        <div className="filters" aria-label="Filter by operation type">
          <Link
            href={operationsUrl(view, undefined, month)}
            aria-current={!type ? "page" : undefined}
          >
            All operations
          </Link>
          {operationTypes.map((t) => (
            <Link
              key={t}
              href={operationsUrl(view, t, month)}
              aria-current={type === t ? "page" : undefined}
            >
              {typeLabels[t]}
            </Link>
          ))}
        </div>
        <div className="view-switch" aria-label="Operations view">
          <Link
            href={operationsUrl("list", type, month)}
            aria-current={view === "list" ? "page" : undefined}
          >
            List
          </Link>
          <Link
            href={operationsUrl("calendar", type, month)}
            aria-current={view === "calendar" ? "page" : undefined}
          >
            Calendar
          </Link>
        </div>
      </div>
      {params.type && !type && (
        <p role="status">
          Unrecognized operation type. Showing all operations.
        </p>
      )}
      {view === "calendar" ? (
        <OperationCalendar operations={all} month={month} type={type} />
      ) : (
        <section className="panel">
          <div className="section-heading">
            <div>
              <h2>{type ? typeLabels[type] : "All operations"}</h2>
              <p>
                {all.length} records · Upcoming first, then past and closed
                operations
              </p>
            </div>
          </div>
          <OperationTable operations={all} />
        </section>
      )}
      <p className="footnote">
        Expected diners include everyone eating, including staff. Retreat staff
        meals are billable at 40% of the standard fee. Additional buffer meals
        are for preparation only.
      </p>
    </>
  );
}
