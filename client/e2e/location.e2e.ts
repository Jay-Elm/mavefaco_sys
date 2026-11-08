import { expect, test } from "@playwright/test";
import { SEED } from "./db";
import { addToCart, signIn } from "./helpers";

const ROUGH = /only gave a rough location/;

test("Use my location: a GPS fix is used quietly, a rough guess asks for GPS or a moved pin", async ({ page, context }) => {
  await context.grantPermissions(["geolocation"]);
  await signIn(page, SEED.customer.email);
  await addToCart(page, SEED.productNoGcash);
  await page.goto("/cart");
  await page.getByRole("button", { name: "Delivery", exact: true }).click();
  await page.getByRole("button", { name: /Set delivery location|Change location/ }).click();

  // GPS: within metres, in Tabaco.
  await context.setGeolocation({ latitude: 13.3594, longitude: 123.7311, accuracy: 15 });
  await page.getByRole("button", { name: "Use my location" }).click();
  await expect(page.locator(".leaflet-marker-icon")).toBeVisible();
  await expect(page.getByText(ROUGH)).toHaveCount(0);

  // No GPS: the browser's guess from the internet address, kilometres off (Iriga).
  await context.setGeolocation({ latitude: 13.4216, longitude: 123.4122, accuracy: 25_000 });
  await page.getByRole("button", { name: "Use my location" }).click();
  await expect(page.getByText(ROUGH)).toBeVisible();

  // Moving the pin by hand clears it.
  await page.locator(".leaflet-container").click({ position: { x: 60, y: 60 } });
  await expect(page.getByText(ROUGH)).toHaveCount(0);
});
