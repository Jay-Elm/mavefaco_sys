import { expect, test } from "@playwright/test";
import { SEED } from "./db";
import { signIn } from "./helpers";

test("Add Product: the crop follows the name until the farmer picks one", async ({ page }) => {
  await signIn(page, SEED.farmer.email);
  await page.goto("/farmer/products/new");

  const name = page.getByLabel("Name", { exact: true });
  const crop = page.getByRole("combobox", { name: "Crop (optional)" });

  await name.fill("Patola");
  await expect(crop).toHaveValue("Patola");

  // Renaming the listing re-guesses the crop; clearing it clears the crop.
  await name.fill("Upo");
  await expect(crop).toHaveValue("Upo");
  await name.fill("");
  await expect(crop).toHaveValue("");

  // A crop picked by hand stays, whatever the listing is called.
  await crop.click();
  await crop.fill("talong");
  await page.getByRole("option", { name: /^Eggplant/ }).click();
  await name.fill("Patola");
  await expect(crop).toHaveValue("Eggplant");
});
