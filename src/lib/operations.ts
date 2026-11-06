import { PrismaClient, OperationType } from "@prisma/client";
import { db } from "./db";
import { dateKey } from "./calendar";
export async function getOperations(
  type?: OperationType,
  client: Pick<PrismaClient, "operation"> = db,
  now = new Date(),
) {
  const records = await client.operation.findMany({
    where: type ? { type } : {},
    include: { location: true },
    orderBy: [{ startDate: "asc" }, { name: "asc" }],
  });
  const upcoming = records.filter(
    (o) =>
      dateKey(o.endDate) >= dateKey(now) &&
      o.status !== "CANCELLED" &&
      o.status !== "COMPLETED",
  );
  const upcomingIds = new Set(upcoming.map((o) => o.id));
  const past = records
    .filter((o) => !upcomingIds.has(o.id))
    .sort((a, b) => b.startDate.getTime() - a.startDate.getTime());
  return { upcoming, all: [...upcoming, ...past] };
}
