import { expect, test } from "@playwright/test";
test("create a recipe, scale it, build a retreat template, and customize an independent operation plan", async ({
  page,
}, testInfo) => {
  test.setTimeout(120000);
  await page.goto("/recipes");
  await page.getByRole("link", { name: "New recipe", exact: true }).click();
  await page
    .getByLabel("Recipe name", { exact: true })
    .fill("Fictional browser stew");
  await page.getByLabel("Standard portions", { exact: true }).fill("10");
  await page
    .getByLabel("Ingredient 1", { exact: true })
    .selectOption("seed-rice");
  await page.getByLabel("Quantity 1", { exact: true }).fill("100");
  await page
    .getByRole("button", { name: "Add ingredient", exact: true })
    .click();
  await page
    .getByLabel("Ingredient 2", { exact: true })
    .selectOption("seed-lentils");
  await page.getByLabel("Unit 2", { exact: true }).selectOption("KILOGRAM");
  await page.getByLabel("Quantity 2", { exact: true }).fill("0.5");
  await page
    .getByRole("button", { name: "Add ingredient", exact: true })
    .click();
  await page
    .getByLabel("Ingredient 3", { exact: true })
    .selectOption("seed-carrots");
  await page.getByLabel("Quantity 3", { exact: true }).fill("250");
  await page
    .getByLabel("Preparation instructions", { exact: true })
    .fill("Cook rice and lentils. Fold in carrots and simmer until tender.");
  await page.getByRole("button", { name: "Save recipe", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Fictional browser stew", exact: true }),
  ).toBeVisible();
  const recipeUrl = page.url().split("?")[0];
  const recipeId = recipeUrl.split("/").at(-1)!;
  await page.reload();
  await page.getByLabel("Preview portions", { exact: true }).fill("30");
  await expect(
    page.getByRole("row").filter({ hasText: "Brown rice" }),
  ).toContainText("300 g");
  await expect(
    page.getByRole("row").filter({ hasText: "Green lentils" }),
  ).toContainText("1500 g");
  await page.getByLabel("Preview portions", { exact: true }).fill("0");
  await expect(
    page.getByRole("status").filter({ hasText: "Portions must be" }),
  ).toContainText("Portions must be");
  await page.getByLabel("Preview portions", { exact: true }).fill("30");
  await page.screenshot({
    path: testInfo.outputPath("recipe-scaling-desktop.png"),
    fullPage: true,
  });
  await page.goto("/recipes/templates/new");
  await page
    .getByLabel("Template name", { exact: true })
    .fill("Fictional browser retreat menu");
  for (let index = 1; index <= 3; index++) {
    await page.getByRole("button", { name: "Add meal", exact: true }).click();
    await page
      .getByLabel(`Day number ${index}`, { exact: true })
      .fill(String(index));
    await page
      .getByLabel(`Recipe ${index}.1`, { exact: true })
      .selectOption(recipeId);
  }
  await page
    .getByRole("button", { name: "Add recipe to meal 1", exact: true })
    .click();
  await page
    .getByLabel("Recipe 1.2", { exact: true })
    .selectOption("seed-recipe-carrot-salad");
  await page
    .getByRole("button", { name: "Save template", exact: true })
    .click();
  await expect(
    page.getByRole("heading", {
      name: "Fictional browser retreat menu",
      exact: true,
    }),
  ).toBeVisible();
  const templateUrl = page.url().split("?")[0];
  const templateId = templateUrl.split("/").at(-1)!;
  await page.goto("/operations/seed-operation-0");
  await page.getByRole("link", { name: "Open meal plan", exact: true }).click();
  await page
    .getByLabel("Menu template", { exact: true })
    .selectOption(templateId);
  await page
    .getByRole("button", { name: "Apply template", exact: true })
    .click();
  await expect(page.getByRole("status")).toHaveText("Meal plan saved.");
  await expect(
    page.getByLabel("Planned portions 1.1", { exact: true }),
  ).toHaveValue("32");
  await page
    .getByLabel("Recipe 1.1", { exact: true })
    .selectOption("seed-recipe-rice");
  await page.getByLabel("Planned portions 1.1", { exact: true }).fill("35");
  await page
    .getByLabel("Meal notes 1", { exact: true })
    .fill("Swap the stew for rice for this operation only.");
  await page
    .getByRole("button", { name: "Save meal plan", exact: true })
    .click();
  await expect(page.locator(".saved-meal").first()).toContainText(
    "35 planned portions",
  );
  await expect(page.locator(".saved-meal").first()).toContainText(
    "Steamed brown rice",
  );
  await expect(page.getByRole("status")).toHaveText("Meal plan saved.");
  await expect(page.getByLabel("Recipe 1.1", { exact: true })).toHaveValue(
    "seed-recipe-rice",
  );
  await page.reload();
  await expect(
    page.getByLabel("Planned portions 1.1", { exact: true }),
  ).toHaveValue("35");
  await expect(
    page.getByText("35 planned portions", { exact: false }).first(),
  ).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: testInfo.outputPath("meal-planner-mobile.png"),
    fullPage: true,
  });
  await page.goto(templateUrl);
  await expect(
    page.getByRole("link", { name: "Fictional browser stew", exact: true }),
  ).toHaveCount(3);
  await expect(
    page.getByRole("heading", { name: "Day 3 · Lunch", exact: true }),
  ).toBeVisible();
  await page.goto("/operations/seed-operation-0");
  await expect(page.getByText("26", { exact: true })).toBeVisible();
  await expect(
    page.getByText("60% discount · 40% of standard fee", { exact: true }),
  ).toBeVisible();
});

test("ingredient creation, duplicate protection, editing, and recipe duplication/archive work", async ({
  page,
}) => {
  await page.goto("/recipes/ingredients/new");
  await page
    .getByLabel("Ingredient name", { exact: true })
    .fill("Fictional sesame seed");
  await page
    .getByLabel("Standard unit", { exact: true })
    .selectOption("KILOGRAM");
  await page.getByLabel("Reference price (BRL)", { exact: true }).fill("12.50");
  await page
    .getByRole("button", { name: "Save ingredient", exact: true })
    .click();
  await expect(page.getByRole("status")).toHaveText("Ingredient saved.");
  await expect(
    page.getByRole("row").filter({ hasText: "Fictional sesame seed" }),
  ).toContainText("R$ 12.50 / kg");
  await page
    .getByRole("link", { name: "Edit Fictional sesame seed", exact: true })
    .click();
  await page
    .getByLabel("Notes", { exact: true })
    .fill("Fictional vegan ingredient.");
  await page
    .getByRole("button", { name: "Save ingredient", exact: true })
    .click();
  await expect(page.getByRole("status")).toHaveText("Ingredient saved.");
  await page.goto("/recipes/ingredients/new");
  await page
    .getByLabel("Ingredient name", { exact: true })
    .fill("FICTIONAL SESAME SEED");
  await page
    .getByRole("button", { name: "Save ingredient", exact: true })
    .click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "already exists",
  );
  await page.goto("/recipes/seed-recipe-rice");
  await page
    .getByRole("button", { name: "Duplicate recipe", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Edit recipe", exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("Recipe name", { exact: true })).toHaveValue(
    "Steamed brown rice (copy)",
  );
  await page
    .getByLabel("Recipe notes", { exact: true })
    .fill("Fictional variation.");
  await page.getByRole("button", { name: "Save recipe", exact: true }).click();
  await expect(
    page.getByRole("heading", {
      name: "Steamed brown rice (copy)",
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Archive recipe", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Restore recipe", exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Restore recipe", exact: true }),
  ).toBeVisible();
});
