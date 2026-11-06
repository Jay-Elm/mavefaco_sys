import { expect, type Page } from "@playwright/test";
import { SEED } from "./db";

/** Signs in through the login form and waits to leave the login page. */
export async function signIn(page: Page, email: string) {
  await page.goto("/login");
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(SEED.password);
  await page.getByRole("button", { name: "Sign In" }).click();
  await expect(page).not.toHaveURL(/\/login/, { timeout: 20_000 });
}

/** Opens a product from the shop and adds 1 to the cart through the quantity dialog. */
export async function addToCart(page: Page, productName: string) {
  await page.goto("/products");
  await page.getByRole("link", { name: productName }).first().click();
  await page.getByRole("button", { name: "Add to Cart" }).first().click();
  const dialog = page.getByRole("dialog", { name: `Choose how much ${productName}` });
  await dialog.getByRole("button", { name: "Add to Cart" }).click();
  await expect(dialog).toBeHidden();
}

/** Saves the signed-in customer's delivery spot through the API (the map itself is drag-and-tap). */
export async function saveLocation(page: Page, lat: number, lng: number, address: string) {
  const res = await page.request.put("/api/users/me/location", { data: { lat, lng, address } });
  expect(res.ok()).toBeTruthy();
  return res.json();
}
