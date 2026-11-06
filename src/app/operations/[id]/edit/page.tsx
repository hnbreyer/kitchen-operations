import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { businessTimezone } from "@/lib/config";
import { dateKey } from "@/lib/calendar";
import { OperationForm } from "@/components/operation-form";
export const dynamic = "force-dynamic";
export default async function EditOperation({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [operation, locations] = await Promise.all([
    db.operation.findUnique({ where: { id } }),
    db.location.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);
  if (!operation) notFound();
  const count = (v: number | null) => (v == null ? "" : String(v));
  const initial = {
    name: operation.name,
    type: operation.type,
    status: operation.status,
    startDate: dateKey(operation.startDate),
    endDate: dateKey(operation.endDate),
    locationId: operation.locationId,
    expectedDiners: count(operation.expectedDiners),
    billableParticipants: count(operation.billableParticipants),
    expectedStaffDiners: count(operation.expectedStaffDiners),
    additionalMealBuffer: count(operation.additionalMealBuffer),
    notes: operation.notes ?? "",
  };
  return (
    <>
      <Link href={`/operations/${id}`} className="text-link">
        ← Back to operation
      </Link>
      <div className="page-heading">
        <div>
          <p className="eyebrow">KEEP THE PLAN CURRENT</p>
          <h1>Edit operation</h1>
          <p>Update the schedule, attendance, and preparation buffer.</p>
        </div>
      </div>
      <OperationForm
        key={operation.updatedAt.toISOString()}
        id={id}
        version={operation.updatedAt.toISOString()}
        initial={initial}
        locations={locations}
        timezone={businessTimezone}
      />
    </>
  );
}
