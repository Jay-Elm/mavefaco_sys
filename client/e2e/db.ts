import "dotenv/config";

/**
 * The end-to-end database: E2E_DATABASE_URL, or the local DATABASE_URL's
 * server with the name `<name>_e2e_test`. Refuses anything that isn't a
 * localhost database ending in `_test`, because setup wipes it.
 */
export function e2eDbUrl(): string {
  let url: URL;
  if (process.env.E2E_DATABASE_URL) {
    url = new URL(process.env.E2E_DATABASE_URL);
  } else {
    if (!process.env.DATABASE_URL) throw new Error("End-to-end tests need E2E_DATABASE_URL or DATABASE_URL");
    url = new URL(process.env.DATABASE_URL);
    url.pathname = `${url.pathname.replace(/^\//, "")}_e2e_test`;
  }
  const name = url.pathname.replace(/^\//, "");
  if (!["localhost", "127.0.0.1", "::1"].includes(url.hostname) || !name.endsWith("_test"))
    throw new Error(`Refusing to run end-to-end tests against "${name}" on "${url.hostname}"`);
  return url.toString();
}

/** The accounts and products globalSetup creates. */
export const SEED = {
  password: "e2e-password-123",
  customer: { email: "customer@e2e.local", name: "Ana Reyes" },
  farmer: { email: "farmer@e2e.local", name: "Mario Santos", gcashName: "Mario Santos", gcashNumber: "09181234567" },
  farmerNoGcash: { email: "farmer2@e2e.local", name: "Lito Cruz" },
  // Staff sign in with a password and an authenticator code; tests skip
  // the code by handing the browser a session (signInStaff in helpers.ts).
  manager: { email: "manager@e2e.local", name: "Rosa Manager" },
  product: "E2E Eggplant",
  productNoGcash: "E2E Okra",
} as const;
