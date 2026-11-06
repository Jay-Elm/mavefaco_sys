import { expect, test } from "@playwright/test";
import { SEED } from "./db";
import { addToCart, saveLocation, signIn } from "./helpers";

// One story, in order: the same order moves from customer to farmer.
test.describe.serial("GCash order, paid and shipped", () => {
  test("a guest can browse the shop", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("link", { name: "All Products" }).first()).toBeVisible();
    await page.goto("/products");
    await expect(page.getByRole("link", { name: SEED.product }).first()).toBeVisible();
  });

  test("a customer orders with GCash and enters the reference", async ({ page }) => {
    await signIn(page, SEED.customer.email);
    await addToCart(page, SEED.product);

    await page.goto("/cart");
    const payment = page.getByLabel("Payment Method");
    // GCash turns on once checkout knows this farmer has it.
    await expect(payment.locator('option[value="gcash"]')).toBeEnabled();
    await payment.selectOption("gcash");
    await expect(page.getByText("enter the reference number in My Orders")).toBeVisible();
    await page.getByRole("button", { name: "Place Order" }).click();

    await expect(page).toHaveURL(/\/customer\/orders/);
    await page.getByRole("button", { name: /Order #1/ }).click();
    // The quantity dialog starts at 0.25 kg: 0.25 × ₱80.
    await expect(page.getByText("Send ₱20.00 by GCash to:")).toBeVisible();
    await expect(page.getByText("0918 123 4567")).toBeVisible();

    await page.getByLabel("Reference number").fill("1234 567 891234");
    await page.getByLabel("Your GCash name").fill(SEED.customer.name);
    await page.getByLabel("Paid from number").fill("0917 123 4567");
    await page.getByRole("button", { name: "I've paid" }).click();
    await expect(page.getByText(/Payment sent \(reference 1234567891234\)/)).toBeVisible();
  });

  test("the farmer confirms the payment, then can ship", async ({ page }) => {
    await signIn(page, SEED.farmer.email);
    await page.goto("/farmer/orders");

    const ship = page.getByRole("button", { name: "Mark Shipped" });
    // Accept first; shipping waits for the payment.
    await page.getByRole("button", { name: "Accept" }).click();
    await expect(ship).toBeDisabled();

    await page.getByRole("button", { name: "Payment received" }).click();
    await page.getByRole("button", { name: "Yes, it arrived" }).click();
    await expect(page.getByText("GCash: paid")).toBeVisible();

    await expect(ship).toBeEnabled();
    await ship.click();
    await expect(page.getByText("shipped", { exact: true })).toBeVisible();
  });

  test("the customer sees it paid and shipped", async ({ page }) => {
    await signIn(page, SEED.customer.email);
    await page.goto("/customer/orders");
    await expect(page.getByText("shipped", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: /Order #1/ }).click();
    await expect(page.getByText(/confirmed your GCash payment/)).toBeVisible();
  });
});

test.describe.serial("Checkout limits", () => {
  test("GCash is unavailable for a farmer without it, and delivery is refused outside the area", async ({ page }) => {
    await signIn(page, SEED.customer.email);
    await addToCart(page, SEED.productNoGcash);
    await saveLocation(page, 13.1391, 123.7438, "Rizal St., Legazpi City"); // outside the area

    await page.goto("/cart");
    await expect(page.getByText("GCash is unavailable: this farmer hasn't set up GCash.")).toBeVisible();
    await expect(page.getByLabel("Payment Method").locator('option[value="gcash"]')).toBeDisabled();

    await page.getByRole("button", { name: "Delivery", exact: true }).click();
    await expect(page.getByText("This spot is outside the area")).toBeVisible();
    await expect(page.getByRole("button", { name: "Place Order" })).toBeDisabled();
  });

  test("delivery inside the area goes through and shows the town", async ({ page }) => {
    await signIn(page, SEED.customer.email);
    // Each test has a fresh browser, and the cart lives in the browser.
    await addToCart(page, SEED.productNoGcash);
    await saveLocation(page, 13.3594, 123.7311, "12 Rizal St., Brgy. Quinale");

    await page.goto("/cart");
    await page.getByRole("button", { name: "Delivery", exact: true }).click();
    await expect(page.getByText("12 Rizal St., Brgy. Quinale")).toBeVisible();
    await page.getByRole("button", { name: "Place Order" }).click();

    await expect(page).toHaveURL(/\/customer\/orders/);
    // Newest first.
    await page.getByRole("button", { name: /Order #\d+/ }).first().click();
    await expect(page.getByText("Delivery, Tabaco City")).toBeVisible();
  });
});
