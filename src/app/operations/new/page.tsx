import Link from "next/link";
import { db } from "@/lib/db";
import { emptyOperation } from "@/lib/operation-input";
import { businessTimezone } from "@/lib/config";
import { OperationForm } from "@/components/operation-form";
export const dynamic = "force-dynamic";
export default async function NewOperation() {
  const locations = await db.location.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
  return (
    <>
      <Link href="/operations" className="text-link">
        ← Back to operations
      </Link>
      <div className="page-heading">
        <div>
          <p className="eyebrow">PLAN THE WORK AHEAD</p>
          <h1>New operation</h1>
          <p>Schedule the dates now. Confirm the people later.</p>
        </div>
      </div>
      <OperationForm
        initial={emptyOperation}
        locations={locations}
        timezone={businessTimezone}
      />
    </>
  );
}
