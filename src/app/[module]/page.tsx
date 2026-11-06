import { notFound } from "next/navigation";
import { businessTimezone } from "@/lib/config";
const modules: Record<
  string,
  { title: string; description: string; planned: string[] }
> = {
  sales: {
    title: "Sales",
    description: "Keep a clear record of individual city sales.",
    planned: [
      "Items, quantities, and prices in BRL",
      "Payment methods and sale dates",
      "Sales linked to operations",
    ],
  },
  finances: {
    title: "Finances",
    description: "Understand the costs and returns of each operation.",
    planned: [
      "Retreat reimbursements separate from service revenue",
      "Estimated costs and actual expenses",
      "Operation profitability without double counting",
    ],
  },
  settings: {
    title: "Settings",
    description: "Workspace configuration and business preferences.",
    planned: [
      "Business profile",
      "Localization preferences",
      "Workspace configuration interface",
    ],
  },
};
export default async function ModulePage({
  params,
}: {
  params: Promise<{ module: string }>;
}) {
  const { module } = await params;
  if (!Object.hasOwn(modules, module)) notFound();
  const content = modules[module];
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">GROWING WITH YOUR KITCHEN</p>
          <h1>{content.title}</h1>
          <p>{content.description}</p>
        </div>
      </div>
      <section className="panel placeholder">
        <span className="subtle-tag">Planned module</span>
        <h2>Not available yet</h2>
        <p>
          These tools are planned. You can review their intended uses below.
        </p>
        <ul>
          {content.planned.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        {module === "settings" && (
          <div className="config-details">
            <p>
              <strong>Language:</strong> English
            </p>
            <p>
              <strong>Currency:</strong> BRL (R$)
            </p>
            <p>
              <strong>Business timezone:</strong> {businessTimezone}
            </p>
            <small>Configure BUSINESS_TIMEZONE in your environment.</small>
          </div>
        )}
      </section>
    </>
  );
}
