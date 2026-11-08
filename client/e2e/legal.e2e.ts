import { expect, test } from "@playwright/test";

test("registration links the Terms and Privacy Policy and needs the box ticked; login doesn't show them", async ({ page }) => {
  await page.goto("/register");
  const terms = page.getByRole("link", { name: "Terms of Service" });
  const privacy = page.getByRole("link", { name: "Privacy Policy" });
  await expect(terms).toHaveAttribute("href", "/terms");
  await expect(privacy).toHaveAttribute("href", "/privacy");

  await page.locator("#name").fill("Juan dela Cruz");
  await page.locator("#email").fill("juan@e2e.local");
  await page.locator("#password").fill("correct-horse-battery");
  await page.getByRole("button", { name: "Create Account" }).click();
  await expect(page.getByText(/confirm you are 18 or older/)).toBeVisible();

  await page.goto("/login");
  await expect(page.getByRole("link", { name: "Terms of Service" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Privacy Policy" })).toHaveCount(0);
});

test("the Terms of Service and Privacy Policy pages open, with their contents", async ({ page }) => {
  await page.goto("/terms");
  await expect(page.getByRole("heading", { level: 1, name: "Terms of Service" })).toBeVisible();
  await expect(page.getByText("You must be at least 18 years old to create an account.")).toBeVisible();
  await page.getByRole("navigation", { name: "On this page" }).getByRole("link", { name: /Orders, payment and delivery/ }).click();
  await expect(page).toHaveURL(/#orders$/);

  await page.goto("/privacy");
  await expect(page.getByRole("heading", { level: 1, name: "Privacy Policy" })).toBeVisible();
  await expect(page.getByRole("heading", { name: /Your rights and how to reach us/ })).toBeVisible();
});
