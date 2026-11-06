import Link from "next/link";
import { getOperations } from "@/lib/operations";
import { operationTypes, typeLabels } from "@/lib/domain";
import { OperationTable } from "@/components/operation-table";
export const dynamic = "force-dynamic";
export default async function Overview() {
  const { upcoming, all } = await getOperations();
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">YOUR KITCHEN, AT A GLANCE</p>
          <h1>Overview</h1>
          <p>A clear view of what’s coming to the table.</p>
        </div>
        <span className="subtle-tag">Planning workspace</span>
      </div>
      <section className="welcome">
        <div>
          <span className="eyebrow">ROOM TO PLAN WELL</span>
          <h2>Good food starts with a little clarity.</h2>
          <p>
            Keep retreat catering, city service, and private events
            <br className="desktop-break" /> together in one organized
            workspace.
          </p>
          <Link className="button" href="/operations">
            View operations <span>↗</span>
          </Link>
        </div>
        <div className="welcome-art" aria-hidden="true">
          <div className="plate">
            <div className="leaf leaf-one" />
            <div className="leaf leaf-two" />
            <div className="leaf leaf-three" />
            <div className="grain" />
          </div>
          <span>PLAN · PREPARE · NOURISH</span>
        </div>
      </section>
      <section aria-label="Operation summary" className="stats">
        <div className="stat">
          <span>Upcoming operations</span>
          <strong>{upcoming.length.toString().padStart(2, "0")}</strong>
          <small>Scheduled or in progress</small>
        </div>
        {operationTypes.map((type) => (
          <div className="stat" key={type}>
            <span>{typeLabels[type]}</span>
            <strong>
              {all
                .filter((o) => o.type === type)
                .length.toString()
                .padStart(2, "0")}
            </strong>
            <small>All recorded operations</small>
          </div>
        ))}
      </section>
      <section className="panel">
        <div className="section-heading">
          <div>
            <h2>Coming up</h2>
            <p>Your next scheduled operations, in date order.</p>
          </div>
          <Link className="text-link" href="/operations">
            View all operations →
          </Link>
        </div>
        <OperationTable operations={upcoming.slice(0, 5)} />
      </section>
      <div className="info-strip">
        <span aria-hidden="true">ⓘ</span>
        <p>
          <strong>Plan meals with confidence.</strong> Open an operation to
          organize its menu and preparation quantities.
        </p>
      </div>
    </>
  );
}
