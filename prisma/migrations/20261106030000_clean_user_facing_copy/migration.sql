-- Content-only cleanup. Exact seed-ID and old-value predicates preserve owner edits.

-- Do not change timestamps, recipe names, instructions, quantities, or menu schedules.

UPDATE "Location" SET "description" = 'Retreat school' WHERE "id" = 'seed-school' AND "description" = 'Fictional retreat school';

UPDATE "Location" SET "description" = 'Rented city kitchen' WHERE "id" = 'seed-city' AND "description" = 'Fictional rented city kitchen';

UPDATE "Location" SET "description" = 'Event venue' WHERE "id" = 'seed-event' AND "description" = 'Fictional event space';

UPDATE "Recipe" SET "description" = 'Brown rice steamed until tender.' WHERE "id" = 'seed-recipe-rice' AND "description" = 'Fictional vegan recipe for development.';

UPDATE "Recipe" SET "description" = 'A hearty stew of green lentils and carrots.' WHERE "id" = 'seed-recipe-lentils' AND "description" = 'Fictional vegan recipe for development.';

UPDATE "Recipe" SET "description" = 'Roasted pumpkin served with chickpeas.' WHERE "id" = 'seed-recipe-pumpkin' AND "description" = 'Fictional vegan recipe for development.';

UPDATE "Recipe" SET "description" = 'Creamy oats with banana and coconut milk.' WHERE "id" = 'seed-recipe-porridge' AND "description" = 'Fictional vegan development recipe.';

UPDATE "Recipe" SET "description" = 'Chickpeas simmered with tomatoes and spinach.' WHERE "id" = 'seed-recipe-chickpea-tomato' AND "description" = 'Fictional vegan development recipe.';

UPDATE "Recipe" SET "description" = 'Grated carrots dressed with lemon and olive oil.' WHERE "id" = 'seed-recipe-carrot-salad' AND "description" = 'Fictional vegan development recipe.';

UPDATE "Recipe" SET "description" = 'A chilled banana, cocoa, and coconut milk pudding.' WHERE "id" = 'seed-recipe-cocoa-pudding' AND "description" = 'Fictional vegan development recipe.';

UPDATE "Recipe" SET "description" = 'Fresh orange juice mixed with water.' WHERE "id" = 'seed-recipe-orange-drink' AND "description" = 'Fictional vegan development recipe.';

UPDATE "MenuTemplate" SET "description" = 'A three-day schedule of breakfasts, lunches, and dinners.' WHERE "id" = 'seed-menu-retreat' AND "description" = 'Fictional reusable vegan menu.';

UPDATE "MenuTemplate" SET "description" = 'A lunch of brown rice, chickpea stew, and carrot salad.' WHERE "id" = 'seed-menu-city' AND "description" = 'Fictional reusable vegan menu.';

UPDATE "MenuTemplate" SET "description" = 'A dinner of roasted pumpkin, carrot salad, and banana cocoa pudding.' WHERE "id" = 'seed-menu-event' AND "description" = 'Fictional reusable vegan menu.';

UPDATE "Operation" SET "notes" = NULL WHERE "id" IN ('seed-operation-0', 'seed-operation-1', 'seed-operation-2', 'seed-operation-3', 'seed-operation-4', 'seed-operation-5', 'seed-operation-6') AND "notes" = 'Fictional development example. All food is vegan.';

UPDATE "Operation" SET "notes" = 'Confirm diner and staff counts before finalizing preparation quantities.' WHERE "id" IN ('seed-retreat-session-3', 'seed-retreat-session-4', 'seed-retreat-session-5', 'seed-retreat-session-6') AND "notes" = 'Fictional retreat at the same school. Attendance is unconfirmed; update guest, staff, and buffer counts when available.';

UPDATE "OperationMealPlan" SET "notes" = NULL WHERE "id" IN ('seed-plan-seed-operation-2', 'seed-plan-seed-operation-5') AND "notes" = 'Fictional example; quantities can be customized per dish.';


-- Clean only exact legacy copy inside snapshots of known seed recipes.
-- Fold JSON path edits over the original document instead of rebuilding meals/dishes.
WITH RECURSIVE
  recipe_copy(recipe_id, old_description, new_description) AS (VALUES
    ('seed-recipe-rice', 'Fictional vegan recipe for development.', 'Brown rice steamed until tender.'),
    ('seed-recipe-lentils', 'Fictional vegan recipe for development.', 'A hearty stew of green lentils and carrots.'),
    ('seed-recipe-pumpkin', 'Fictional vegan recipe for development.', 'Roasted pumpkin served with chickpeas.'),
    ('seed-recipe-porridge', 'Fictional vegan development recipe.', 'Creamy oats with banana and coconut milk.'),
    ('seed-recipe-chickpea-tomato', 'Fictional vegan development recipe.', 'Chickpeas simmered with tomatoes and spinach.'),
    ('seed-recipe-carrot-salad', 'Fictional vegan development recipe.', 'Grated carrots dressed with lemon and olive oil.'),
    ('seed-recipe-cocoa-pudding', 'Fictional vegan development recipe.', 'A chilled banana, cocoa, and coconut milk pudding.'),
    ('seed-recipe-orange-drink', 'Fictional vegan development recipe.', 'Fresh orange juice mixed with water.')
  ),
  edits(plan_id, path, replacement) AS (
    SELECT plan.id,
      '$[' || meal.key || '].dishes[' || dish.key || '].snapshot.description',
      copy.new_description
    FROM "OperationMealPlan" AS plan,
      json_each(plan."scheduleJson") AS meal,
      json_each(meal.value, '$.dishes') AS dish
    JOIN recipe_copy AS copy
      ON json_extract(dish.value, '$.snapshot.recipeId') = copy.recipe_id
      AND json_extract(dish.value, '$.snapshot.description') = copy.old_description
    UNION ALL
    SELECT plan.id, '$[' || meal.key || '].notes', ''
    FROM "OperationMealPlan" AS plan, json_each(plan."scheduleJson") AS meal
    WHERE plan.id = 'seed-plan-seed-operation-5'
      AND json_extract(meal.value, '$.notes') = 'Custom fictional celebration menu.'
  ),
  ordered AS (
    SELECT plan_id, path, replacement,
      row_number() OVER (PARTITION BY plan_id ORDER BY path) AS step
    FROM edits
  ),
  cleaned(plan_id, step, document) AS (
    SELECT plan.id, 0, plan."scheduleJson" FROM "OperationMealPlan" AS plan
    WHERE plan.id IN (SELECT plan_id FROM edits)
    UNION ALL
    SELECT cleaned.plan_id, ordered.step,
      json_set(cleaned.document, ordered.path, ordered.replacement)
    FROM cleaned JOIN ordered
      ON ordered.plan_id = cleaned.plan_id AND ordered.step = cleaned.step + 1
  )
UPDATE "OperationMealPlan"
SET "scheduleJson" = (
  SELECT document FROM cleaned WHERE plan_id = "OperationMealPlan".id
  ORDER BY step DESC LIMIT 1
)
WHERE id IN (SELECT plan_id FROM edits);
