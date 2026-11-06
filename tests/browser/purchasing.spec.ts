import { expect, test } from "@playwright/test";
test("consolidate retreat requirements, shop on mobile, review changes, and preserve ownership", async ({
  page,
}, testInfo) => {
  test.setTimeout(120000);
  // Prepare an existing three-day retreat through the normal menu workflow.
  await page.goto("/operations/seed-operation-0/meals");
  await page
    .getByLabel("Menu template", { exact: true })
    .selectOption("seed-menu-retreat");
  const replace = page.getByRole("checkbox", {
    name: "Replace the existing meal plan and its customizations.",
  });
  if (await replace.count()) await replace.check();
  await page
    .getByRole("button", { name: "Apply template", exact: true })
    .click();
  await expect(page.getByRole("status")).toHaveText("Meal plan saved.");
  await page.goto("/operations/seed-operation-0");
  await page
    .getByRole("link", { name: "Ingredients & Shopping", exact: true })
    .click();
  await expect(
    page.getByText("School-owned purchasing · Organic sourcing required", {
      exact: true,
    }),
  ).toBeVisible();
  const riceRequirement = page.getByRole("row").filter({
    has: page.getByRole("cell", { name: "Brown rice", exact: true }),
  });
  await expect(riceRequirement).toContainText("5760 g");
  await expect(riceRequirement).toContainText("Not recorded");
  await expect(riceRequirement).toContainText("R$ 43.20");
  await page
    .getByRole("button", { name: "Generate shopping list", exact: true })
    .click();
  await expect(page.getByRole("status")).toHaveText("Shopping list generated.");
  await page.setViewportSize({ width: 390, height: 844 });
  const rice = page.getByRole("article", {
    name: "Shopping item Brown rice",
    exact: true,
  });
  await rice
    .getByText("Edit purchase quantity, price, or notes", { exact: true })
    .click();
  await rice
    .getByLabel("Purchase unit", { exact: true })
    .selectOption("KILOGRAM");
  await rice
    .getByLabel("Planned purchase quantity", { exact: true })
    .fill("7.5");
  await rice.getByLabel("Price per", { exact: true }).selectOption("KILOGRAM");
  await rice
    .getByLabel("Estimated unit price (BRL)", { exact: true })
    .fill("12.50");
  await rice
    .getByLabel("Supplier or shopping notes", { exact: true })
    .fill("Buy organic rice from the market.");
  await rice
    .getByRole("button", { name: "Save shopping item", exact: true })
    .click();
  await expect(rice.locator(".shopping-quantity")).toContainText("7500 g");
  await expect(rice).toContainText("Buy organic rice from the market.");
  await rice
    .getByRole("button", { name: "Mark purchased", exact: true })
    .click();
  await expect(rice.getByText("Purchased", { exact: true })).toBeVisible();
  await page.reload();
  await expect(rice.locator(".shopping-quantity")).toContainText("7500 g");
  await expect(rice.getByText("Purchased", { exact: true })).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: testInfo.outputPath("shopping-list-mobile.png"),
    fullPage: true,
  });
  await page.goto("/operations/seed-operation-0/meals");
  await page.getByLabel("Planned portions 2.1", { exact: true }).fill("40");
  await page
    .getByRole("button", { name: "Save meal plan", exact: true })
    .click();
  await expect(page.locator(".saved-meal").nth(1)).toContainText(
    "40 planned portions",
  );
  await page.goto("/operations/seed-operation-0/shopping");
  await expect(
    page.getByText("Requirements changed since this list was reviewed.", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(rice.locator(".shopping-quantity")).toContainText("7500 g");
  await expect(rice.getByText("Purchased", { exact: true })).toBeVisible();
  await page
    .getByRole("link", { name: "Review requirement changes", exact: true })
    .click();
  await expect(
    page.getByLabel("Action for Brown rice", { exact: true }),
  ).toHaveValue("KEEP");
  await page
    .getByRole("button", { name: "Apply reviewed changes", exact: true })
    .click();
  await expect(rice).toContainText("Required at last review: 6240 g");
  await page.reload();
  await expect(rice.locator(".shopping-quantity")).toContainText("7500 g");
  await expect(rice).toContainText("Buy organic rice from the market.");
  await expect(rice.getByText("Purchased", { exact: true })).toBeVisible();
  const stockSection = page.locator("section").filter({
    has: page.getByRole("heading", {
      name: "Available quantities",
      exact: true,
    }),
  });
  const riceStock = stockSection.locator("details").filter({
    has: page.locator("summary").filter({ hasText: /^Brown rice/ }),
  });
  await riceStock.locator("summary").click();
  await riceStock
    .getByLabel("Available quantity estimate", { exact: true })
    .fill("500");
  await riceStock
    .getByRole("button", { name: "Save availability estimate", exact: true })
    .click();
  await expect(riceRequirement).toContainText("500 g");
  const substitutions = page.locator("section").filter({
    has: page.getByRole("heading", {
      name: "Operation-specific substitutions",
      exact: true,
    }),
  });
  const carrots = substitutions
    .locator("details")
    .filter({ has: page.locator("summary").filter({ hasText: /^Carrots$/ }) });
  await carrots.locator("summary").click();
  await carrots
    .getByLabel("Replacement ingredient", { exact: true })
    .selectOption("seed-pumpkin");
  await carrots
    .getByLabel("Replacement unit", { exact: true })
    .selectOption("KILOGRAM");
  await carrots
    .getByLabel("Total replacement quantity", { exact: true })
    .fill("2");
  await carrots
    .getByRole("button", { name: "Save substitution", exact: true })
    .click();
  await expect(
    page.locator("summary").filter({ hasText: /Carrots → Pumpkin/ }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.locator("summary").filter({ hasText: /Carrots → Pumpkin/ }),
  ).toBeVisible();
  await expect(rice.locator(".shopping-quantity")).toContainText("7500 g");
  await page.emulateMedia({ media: "print" });
  await expect(page.locator(".print-only")).toBeVisible();
  await expect(page.locator(".print-only")).toContainText(
    "School-owned · Organic required",
  );
  await expect(page.locator(".shopping-screen")).toBeHidden();
  await page.screenshot({
    path: testInfo.outputPath("shopping-list-print.png"),
    fullPage: true,
  });
  await page.emulateMedia({ media: "screen" });
  await page.goto("/operations/seed-operation-2/shopping");
  await expect(
    page.getByText(
      "Business-owned purchasing · Shared with city service and private events",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(
    page.getByRole("row").filter({
      has: page.getByRole("cell", { name: "Brown rice", exact: true }),
    }),
  ).toContainText("3000 g");
  await page.goto("/purchasing");
  await expect(
    page.getByRole("heading", { name: "Purchasing", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("School-owned · Organic required", { exact: true }).first(),
  ).toBeVisible();
});
