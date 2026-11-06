import { expect, test } from "@playwright/test";
test("database-backed overview, operation filtering, and planned module navigation", async ({
  page,
}, testInfo) => {
  await page.goto("/");
  await expect(page.getByRole("banner")).not.toContainText("Local development");
  await expect(page.getByRole("contentinfo")).not.toContainText("Foundation");
  await expect(
    page.getByRole("heading", { name: "Overview", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("cell", { name: "Weekend renewal retreat", exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath("overview-desktop.png"),
    fullPage: true,
  });
  await page
    .getByRole("navigation")
    .getByRole("link", { name: "Operations", exact: true })
    .click();
  await expect(page.getByRole("row")).toHaveCount(12);
  await page.getByRole("link", { name: "Retreat", exact: true }).click();
  await expect(page.getByRole("row")).toHaveCount(7);
  await expect(
    page.getByRole("cell", { name: "32 26 full-rate" }),
  ).toBeVisible();
  await expect(
    page.getByRole("cell", { name: "Tuesday lunch service" }),
  ).toHaveCount(0);
  await page
    .getByRole("navigation")
    .getByRole("link", { name: "Purchasing" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Purchasing", exact: true }),
  ).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole("navigation")).toBeVisible();
  await page
    .getByRole("navigation")
    .getByRole("link", { name: "Operations", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Operations", exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath("operations-mobile.png"),
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});

test("create, inspect, edit, calendar, status, and explicitly confirmed deletion persist", async ({
  page,
}) => {
  await page.goto("/operations");
  await page.getByRole("link", { name: "New operation", exact: true }).click();
  await page.getByLabel("Operation name").fill("Fictional browser retreat");
  await page.getByLabel("Start date").fill("2027-02-27");
  await page.getByLabel("End date").fill("2027-03-02");
  await page
    .getByLabel("Location", { exact: false })
    .selectOption("seed-school");
  await page.getByLabel("Expected diners", { exact: true }).fill("32");
  await page.getByLabel("Full-rate billable participants").fill("26");
  await page.getByLabel("Expected staff diners").fill("6");
  await page.getByLabel("Additional meal buffer").fill("2");
  await page
    .getByLabel("Notes", { exact: true })
    .fill("Fictional retreat; staff meals have a 60% discount.");
  await expect(
    page.getByText("Preparation target: 34 meals", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Create operation", exact: true })
    .click();
  await expect(
    page.getByRole("heading", {
      name: "Fictional browser retreat",
      exact: true,
    }),
  ).toBeVisible();
  const detailUrl = page.url().split("?")[0];
  await expect(
    page.getByText("60% discount · 40% of standard fee", { exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Back to operations" }).click();
  await page
    .getByRole("link", { name: "Fictional browser retreat", exact: true })
    .click();
  await page.getByRole("link", { name: "Edit operation", exact: true }).click();
  await page
    .getByLabel("Operation name")
    .fill("Fictional confirmed attendance");
  await page.getByLabel("Expected diners", { exact: true }).fill("40");
  await page.getByLabel("Full-rate billable participants").fill("30");
  await page.getByLabel("Expected staff diners").fill("8");
  await page.getByLabel("Additional meal buffer").fill("4");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(
    page.getByRole("heading", {
      name: "Fictional confirmed attendance",
      exact: true,
    }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", {
      name: "Fictional confirmed attendance",
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.getByText("44 meals", { exact: true })).toBeVisible();
  await expect(
    page.getByText("Fictional retreat; staff meals have a 60% discount.", {
      exact: true,
    }),
  ).toBeVisible();
  await page.goto("/operations?view=calendar&month=2027-02&type=RETREAT");
  await expect(
    page.getByRole("link", { name: /Fictional confirmed attendance/ }),
  ).toHaveCount(2);
  await page.getByRole("link", { name: "Next month", exact: true }).click();
  await expect(page).toHaveURL(/month=2027-03/);
  await expect(page).toHaveURL(/type=RETREAT/);
  await expect(
    page.getByRole("link", { name: /Fictional confirmed attendance/ }),
  ).toHaveCount(2);
  await page
    .getByRole("link", { name: /Fictional confirmed attendance/ })
    .first()
    .click();
  await page
    .getByLabel("Operation status", { exact: true })
    .selectOption("CANCELLED");
  await page
    .getByRole("button", { name: "Update status", exact: true })
    .click();
  await expect(page.getByRole("status")).toHaveText("Status updated.");
  await page.reload();
  await expect(
    page.getByLabel("Operation status", { exact: true }),
  ).toHaveValue("CANCELLED");
  await expect(page.getByText("44 meals", { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "Delete operation", exact: true })
    .click();
  await expect(
    page.getByRole("button", {
      name: "Permanently delete operation",
      exact: true,
    }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: "Keep operation", exact: true })
    .click();
  await page.reload();
  await expect(
    page.getByRole("heading", {
      name: "Fictional confirmed attendance",
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Delete operation", exact: true })
    .click();
  await page
    .getByRole("checkbox", {
      name: "I understand this permanently deletes this operation.",
    })
    .check();
  await page
    .getByRole("button", { name: "Permanently delete operation", exact: true })
    .click();
  await expect(page.getByRole("status")).toHaveText(
    "Operation deleted. Other records were preserved.",
  );
  await expect(
    page.getByRole("link", {
      name: "Fictional confirmed attendance",
      exact: true,
    }),
  ).toHaveCount(0);
  await page.goto(detailUrl);
  await expect(page.getByText("This page could not be found.")).toBeVisible();
});

test("shows server-side validation errors and keeps entered values", async ({
  page,
}) => {
  await page.goto("/operations/new");
  await page.getByLabel("Operation name").fill("Fictional invalid schedule");
  await page.getByLabel("Start date").fill("2027-05-10");
  await page.getByLabel("End date").fill("2027-05-09");
  await page
    .getByLabel("Location", { exact: false })
    .selectOption("seed-school");
  await page
    .getByRole("button", { name: "Create operation", exact: true })
    .click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "End date must be on or after start date.",
  );
  await expect(page.getByLabel("Operation name")).toHaveValue(
    "Fictional invalid schedule",
  );
  await expect(page.getByLabel("Location", { exact: false })).toHaveValue(
    "seed-school",
  );
  await page
    .getByLabel("Operation type", { exact: true })
    .selectOption("CITY_SERVICE");
  await expect(page.getByLabel("Expected staff diners")).toHaveCount(0);
  await expect(page.getByLabel("Full-rate billable participants")).toHaveCount(
    0,
  );
});

test("operation forms and the calendar remain usable on mobile", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/operations/new");
  await expect(page.getByLabel("Expected staff diners")).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: testInfo.outputPath("operation-form-mobile.png"),
    fullPage: true,
  });
  await page.goto("/operations?view=calendar");
  const previousMonth = await page.locator(".calendar-heading h2").innerText();
  await page.getByRole("link", { name: "Next month", exact: true }).click();
  await expect(page.locator(".calendar-heading h2")).not.toHaveText(
    previousMonth,
  );
  await expect(page.locator(".calendar-event").first()).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: testInfo.outputPath("operation-calendar-mobile.png"),
    fullPage: true,
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({
    path: testInfo.outputPath("operation-calendar-desktop.png"),
    fullPage: true,
  });
});
