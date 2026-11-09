import { expect, test } from "@playwright/test";
import { Client } from "pg";
import { e2eDbUrl } from "./db";

test("home page: two banners until 'Show all banners', and one row of announcements", async ({ page }) => {
  const db = new Client({ connectionString: e2eDbUrl() });
  await db.connect();
  for (const [i, title] of ["First banner", "Second banner", "Third banner"].entries())
    await db.query(`INSERT INTO "Banner" (title, "displayOrder") VALUES ($1, $2)`, [title, i + 1]);
  const author = (await db.query(`SELECT id FROM "User" WHERE role = 'manager' LIMIT 1`)).rows[0].id;
  for (const title of ["News one", "News two", "News three"])
    await db.query(`INSERT INTO "Announcement" (title, body, "authorId") VALUES ($1, 'b', $2)`, [title, author]);
  await db.end();

  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/");
  const third = page.getByRole("heading", { name: "Third banner" });
  await expect(page.getByRole("heading", { name: "Second banner" })).toBeVisible();
  await expect(third).toHaveCount(0);
  await page.getByRole("button", { name: "Show all banners (3)" }).click();
  await expect(third).toBeVisible();
  await page.getByRole("button", { name: "Show fewer banners" }).click();
  await expect(third).toHaveCount(0);

  // Two announcement cards, the third under "View all".
  await expect(page.locator("#announcements-heading ~ * article, section[aria-labelledby='announcements-heading'] article")).toHaveCount(2);
  await expect(page.getByRole("button", { name: /View all announcements \(3\)/ }).first()).toBeVisible();
});
