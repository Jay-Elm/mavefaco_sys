import { expect, type Page } from "@playwright/test";
import jwt from "jsonwebtoken";
import { Client } from "pg";
import { SEED, e2eDbUrl } from "./db";

/** Signs in through the login form and waits to leave the login page. */
export async function signIn(page: Page, email: string) {
  await page.goto("/login");
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(SEED.password);
  await page.getByRole("button", { name: "Sign In" }).click();
  await expect(page).not.toHaveURL(/\/login/, { timeout: 20_000 });
}

/**
 * Signs a staff account in by handing the browser a session cookie, signed
 * the way the server signs one after a successful login. (The login form
 * would also ask for an authenticator code, which the MFA tests cover.)
 */
export async function signInStaff(page: Page, email: string) {
  const db = new Client({ connectionString: e2eDbUrl() });
  await db.connect();
  const { rows } = await db.query(`SELECT id, email, role, "tokenVersion" FROM "User" WHERE email = $1`, [email]);
  await db.end();
  const u = rows[0];
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET is needed to sign a staff session");
  const token = jwt.sign({ id: u.id, email: u.email, role: u.role, tokenVersion: u.tokenVersion }, secret, { expiresIn: "1h" });
  // The baseURL in playwright.config.ts.
  await page.context().addCookies([{ name: "token", value: token, url: "http://localhost:3200", httpOnly: true, sameSite: "Lax" }]);
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
