import { expect, test } from "@playwright/test";
test("record a retreat purchase, receive partial and final reimbursements, and keep business purchases ineligible", async ({
  page,
}) => {
  await page.goto("/operations/seed-operation-0");
  await page
    .getByRole("link", { name: "Record ingredient purchase", exact: true })
    .click();
  await expect(
    page.getByRole("heading", {
      name: "Record ingredient purchase",
      exact: true,
    }),
  ).toBeVisible();
  await page.getByLabel("Purchase date", { exact: true }).fill("2040-01-01");
  await page
    .getByLabel("Supplier or store", { exact: true })
    .fill("Browser retreat market");
  await page
    .getByLabel("Ingredient 1", { exact: true })
    .selectOption("seed-rice");
  await page
    .getByLabel("Quantity unit 1", { exact: true })
    .selectOption("KILOGRAM");
  await page.getByLabel("Purchased quantity 1", { exact: true }).fill("2");
  await page
    .getByLabel("Price per 1", { exact: true })
    .selectOption("KILOGRAM");
  await page
    .getByLabel("Actual unit price (BRL) 1", { exact: true })
    .fill("10.00");
  await page
    .getByLabel(
      "I confirm these retreat ingredients meet organic sourcing requirements.",
    )
    .check();
  await page
    .getByLabel(
      "I have checked the actual quantities and prices against the purchase.",
    )
    .check();
  // A server-side validation failure retains all controlled inputs.
  await page
    .getByLabel("Actual unit price (BRL) 1", { exact: true })
    .fill("-1");
  await page
    .getByRole("button", { name: "Record purchase", exact: true })
    .click();
  await expect(page.locator(".form-alert")).toBeVisible();
  await expect(
    page.getByLabel("Supplier or store", { exact: true }),
  ).toHaveValue("Browser retreat market");
  await expect(
    page.getByLabel("Purchased quantity 1", { exact: true }),
  ).toHaveValue("2");
  await page
    .getByLabel("Actual unit price (BRL) 1", { exact: true })
    .fill("10.00");
  await page
    .getByRole("button", { name: "Record purchase", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Purchase from Browser retreat market" }),
  ).toBeVisible();
  const purchaseUrl = page.url();
  await expect(
    page.getByText("Actual purchase total: R$ 20.00", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Outstanding reimbursement balance: R$ 20.00", {
      exact: true,
    }),
  ).toBeVisible();
  await page.goto("/operations/seed-operation-0");
  await expect(
    page.getByRole("link", { name: "Browser retreat market", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "Manage reimbursements", exact: true })
    .click();
  await page
    .getByLabel("Reimbursement date", { exact: true })
    .fill("2040-01-02");
  const amount = page.getByLabel("Payment toward Browser retreat market", {
    exact: false,
  });
  await amount.fill("20.01");
  await page
    .getByRole("button", { name: "Record reimbursement", exact: true })
    .click();
  await expect(page.locator(".form-alert")).toContainText("exceeds");
  await expect(amount).toHaveValue("20.01");
  await amount.fill("7.00");
  await page
    .getByRole("button", { name: "Record reimbursement", exact: true })
    .click();
  await expect(page.getByRole("status")).toHaveText("Reimbursement recorded.");
  await page.goto(purchaseUrl);
  await expect(
    page.getByText("Partially reimbursed", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Outstanding reimbursement balance: R$ 13.00", {
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "Record reimbursement payment", exact: true })
    .click();
  await page
    .getByLabel("Reimbursement date", { exact: true })
    .fill("2040-01-02");
  await page
    .getByLabel("Payment toward Browser retreat market", { exact: false })
    .fill("13.00");
  await page
    .getByRole("button", { name: "Record reimbursement", exact: true })
    .click();
  await expect(page.getByRole("status")).toHaveText("Reimbursement recorded.");
  await page.goto(purchaseUrl);
  await expect(page.getByText("Reimbursed", { exact: true })).toBeVisible();
  await expect(
    page.getByText("Outstanding reimbursement balance: R$ 0.00", {
      exact: true,
    }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByText("Reimbursed: R$ 20.00", { exact: true }),
  ).toBeVisible();
  // The shared business workflow uses the same form, but cannot produce school claims.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/purchasing/new");
  await page.getByLabel("Purchase date", { exact: true }).fill("2040-01-01");
  await page
    .getByLabel("Supplier or store", { exact: true })
    .fill("Browser business store");
  await page
    .getByLabel("Ingredient 1", { exact: true })
    .selectOption("seed-rice");
  await page
    .getByLabel("Quantity unit 1", { exact: true })
    .selectOption("KILOGRAM");
  await page.getByLabel("Purchased quantity 1", { exact: true }).fill("1");
  await page
    .getByRole("button", { name: "Use reference estimate for item 1" })
    .click();
  await page
    .getByLabel(
      "I have checked the actual quantities and prices against the purchase.",
    )
    .check();
  await page
    .getByRole("button", { name: "Record purchase", exact: true })
    .click();
  await expect(page.getByText("Not eligible", { exact: true })).toBeVisible();
  await page.goto("/purchasing/reimbursements");
  await expect(
    page.getByLabel("Payment toward Browser business store", { exact: false }),
  ).toHaveCount(0);
  await expect(
    page.getByLabel("Payment toward Browser retreat market", { exact: false }),
  ).toHaveCount(0);
  await page.goto("/purchasing?funding=BUSINESS");
  await expect(
    page.getByRole("link", { name: "Browser business store", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Browser retreat market", exact: true }),
  ).toHaveCount(0);
});
