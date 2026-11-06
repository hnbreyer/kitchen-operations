import Link from "next/link";
import { db } from "@/lib/db";
import type { TemplateMeal } from "@/lib/menus/types";
export const dynamic = "force-dynamic";
export default async function Templates() {
  const templates = await db.menuTemplate.findMany({
    orderBy: { name: "asc" },
  });
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>Menu templates</h1>
          <p>
            Reusable schedules for retreats, city service, and private events.
          </p>
        </div>
        <Link className="button" href="/recipes/templates/new">
          New template
        </Link>
      </div>
      <div className="library-grid">
        {templates.map((t) => {
          const meals: TemplateMeal[] = JSON.parse(t.scheduleJson);
          return (
            <Link
              key={t.id}
              href={`/recipes/templates/${t.id}`}
              className="panel recipe-card"
            >
              <span className="subtle-tag">Reusable menu</span>
              <h2>{t.name}</h2>
              <p>{t.description || "No description added."}</p>
              <small>
                {Math.max(...meals.map((m) => m.day))} days · {meals.length}{" "}
                meals
              </small>
            </Link>
          );
        })}
      </div>
      {!templates.length && (
        <p className="panel empty">
          No templates yet. Create a schedule to reuse across operations.
        </p>
      )}
    </>
  );
}
