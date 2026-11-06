import Link from "next/link";
import type { Operation, Location } from "@prisma/client";
import { typeLabels, statusLabels } from "@/lib/domain";
import { formatDate } from "@/lib/config";
export function OperationTable({
  operations,
}: {
  operations: (Operation & { location: Location })[];
}) {
  if (!operations.length)
    return (
      <div className="empty">
        <h3>No operations to show</h3>
        <p>
          Scheduled operations will appear here once records are added to the
          database.
        </p>
      </div>
    );
  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>Operation</th>
            <th>Type</th>
            <th>Dates</th>
            <th>Location</th>
            <th>Status</th>
            <th>Expected diners</th>
          </tr>
        </thead>
        <tbody>
          {operations.map((o) => (
            <tr key={o.id}>
              <td className="operation-name">
                <Link href={`/operations/${o.id}`}>{o.name}</Link>
              </td>
              <td>
                <span className={`type type-${o.type.toLowerCase()}`}>
                  {typeLabels[o.type]}
                </span>
              </td>
              <td className="dates">
                {formatDate(o.startDate)}
                {formatDate(o.startDate) !== formatDate(o.endDate) && (
                  <>
                    <br />
                    <span>to {formatDate(o.endDate)}</span>
                  </>
                )}
              </td>
              <td>{o.location.name}</td>
              <td>
                <span className={`status status-${o.status.toLowerCase()}`}>
                  {statusLabels[o.status]}
                </span>
              </td>
              <td>
                {o.expectedDiners ?? "—"}
                {o.billableParticipants != null && (
                  <small className="billable">
                    {o.billableParticipants} full-rate
                  </small>
                )}
                {o.expectedStaffDiners != null && (
                  <small className="billable">
                    {o.expectedStaffDiners} staff at 40%
                  </small>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
