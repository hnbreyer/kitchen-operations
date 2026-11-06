import { expect, test } from "@playwright/test";
test("reference quotes support recipe scaling, shopping totals, quantity edits and saved-price priority", async ({
  page,
}) => {
  await page.goto("/recipes/seed-recipe-rice");
  await expect(
    page.getByText("Estimated ingredient total: R$ 4.50", { exact: false }),
  ).toBeVisible();
  await page.getByLabel("Preview portions", { exact: true }).fill("30");
  await expect(
    page.getByText("Estimated ingredient total: R$ 13.50", { exact: false }),
  ).toBeVisible();
  await page.goto("/recipes/ingredients");
  await expect(
    page.getByRole("row").filter({
      has: page.getByRole("cell", { name: "Brown rice", exact: true }),
    }),
  ).toContainText("R$ 7.50 / kg");
  await expect(
    page.getByRole("row").filter({
      has: page.getByRole("cell", {
        name: "Unsweetened coconut milk",
        exact: true,
      }),
    }),
  ).toContainText("R$ 40.00 / L");
  await page.goto("/operations/seed-operation-2/shopping");
  const rice = page.getByRole("article", {
    name: "Shopping item Brown rice",
    exact: true,
  });
  async function openEditor() {
    if (
      !(await rice
        .getByLabel("Planned purchase quantity", { exact: true })
        .isVisible())
    )
      await rice
        .getByText("Edit purchase quantity, price, or notes", { exact: true })
        .click();
  }
  await openEditor();
  await rice
    .getByLabel("Purchase unit", { exact: true })
    .selectOption("KILOGRAM");
  await rice.getByLabel("Planned purchase quantity", { exact: true }).fill("2");
  await rice
    .getByRole("button", { name: "Save shopping item", exact: true })
    .click();
  await expect(
    rice.getByText("Estimated purchase cost: R$ 15.00", { exact: true }),
  ).toBeVisible();
  await openEditor();
  await rice.getByLabel("Estimated unit price (BRL)", { exact: true }).fill("");
  await rice
    .getByRole("button", { name: "Save shopping item", exact: true })
    .click();
  await expect(
    rice.getByText("Catalog reference: R$ 7.50 / kg", { exact: true }),
  ).toBeVisible();
  await openEditor();
  await rice
    .getByLabel("Purchase unit", { exact: true })
    .selectOption("KILOGRAM");
  await rice.getByLabel("Planned purchase quantity", { exact: true }).fill("3");
  await rice
    .getByRole("button", { name: "Save shopping item", exact: true })
    .click();
  await expect(
    rice.getByText("Estimated purchase cost: R$ 22.50", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    rice.getByText("Estimated purchase cost: R$ 22.50", { exact: true }),
  ).toBeVisible();
  await expect(page.locator(".shopping-cost-summary")).toContainText(
    "Estimated shopping total:",
  );
  await expect(page.locator(".shopping-cost-summary")).not.toContainText(
    "Total incomplete.",
  );
  await openEditor();
  await rice
    .getByLabel("Estimated unit price (BRL)", { exact: true })
    .fill("9.00");
  await rice
    .getByRole("button", { name: "Save shopping item", exact: true })
    .click();
  await expect(
    rice.getByText("Estimated purchase cost: R$ 27.00", { exact: true }),
  ).toBeVisible();
  await page.goto("/recipes/ingredients/seed-rice/edit");
  await expect(page.getByLabel("Standard unit", { exact: true })).toHaveValue(
    "GRAM",
  );
  await expect(
    page.getByLabel("Reference price per", { exact: true }),
  ).toHaveValue("KILOGRAM");
  await page.getByLabel("Reference price (BRL)", { exact: true }).fill("8.25");
  await page
    .getByRole("button", { name: "Save ingredient", exact: true })
    .click();
  await expect(
    page.getByRole("row").filter({
      has: page.getByRole("cell", { name: "Brown rice", exact: true }),
    }),
  ).toContainText("R$ 8.25 / kg");
  await page.goto("/operations/seed-operation-2/shopping");
  await expect(
    rice.getByText("Estimated purchase cost: R$ 27.00", { exact: true }),
  ).toBeVisible();
  await expect(
    rice.getByText("List-specific estimate: R$ 9.00 / kg", { exact: true }),
  ).toBeVisible();
});
