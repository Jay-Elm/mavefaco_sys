import { expect, test } from "@playwright/test";
import { SEED } from "./db";
import { signIn, signInStaff } from "./helpers";

// In order: staff link a listing to its crop, and the Market pages then count it.
test.describe.serial("Staff: crops, products and the Market", () => {
  test("Crop Types finds a crop by a local name, Garlic included", async ({ page }) => {
    await signInStaff(page, SEED.manager.email);
    await page.goto("/dashboard/crop-types");
    await expect(page.getByRole("heading", { name: "Crop Types" })).toBeVisible();

    const search = page.getByLabel("Search crops");
    await search.fill("bawang");
    await expect(page.getByRole("cell", { name: /^Garlic/ })).toBeVisible();
    await search.fill("talong");
    await expect(page.getByRole("cell", { name: /^Eggplant/ })).toBeVisible();
  });

  test("Products: icons are named, and staff link a listing to its crop", async ({ page }) => {
    await signInStaff(page, SEED.manager.email);
    await page.goto("/dashboard/products");

    // Both seeded listings start without a crop.
    await page.getByRole("button", { name: "2 not linked to a crop" }).click();
    const row = page.getByRole("row", { name: new RegExp(SEED.product) });
    await expect(row.getByRole("img", { name: "Approved" })).toBeVisible();
    const suspend = row.getByRole("button", { name: "Suspend" });
    await expect(suspend).toBeVisible();
    // The label shows on hover.
    await suspend.hover();
    await expect(row.getByRole("tooltip").filter({ hasText: "Suspend" })).toBeVisible();

    const crop = row.getByRole("combobox", { name: "Crop" });
    await crop.click();
    await crop.fill("talong");
    await page.getByRole("option", { name: /^Eggplant/ }).click();
    await expect(page.getByRole("button", { name: "1 not linked to a crop" })).toBeVisible();
  });

  test("Market: the linked crop shows for staff and farmers", async ({ page }) => {
    await signInStaff(page, SEED.manager.email);
    await page.goto("/dashboard/market");
    // A local name finds the crop, as the search box suggests.
    await page.getByLabel("Search crops").fill("talong");
    await expect(page.getByRole("cell", { name: /Eggplant/ }).first()).toBeVisible();

    await page.context().clearCookies();
    await signIn(page, SEED.farmer.email);
    await page.goto("/farmer/market");
    await page.getByLabel("Search crops").fill("eggplant");
    await expect(page.getByRole("cell", { name: /Eggplant/ }).first()).toBeVisible();
  });
});
