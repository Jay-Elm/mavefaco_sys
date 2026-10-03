import "dotenv/config";

/**
 * Connection string for the integration-test database.
 *
 * Uses TEST_DATABASE_URL if set (CI sets it), otherwise reuses the local
 * dev DATABASE_URL's server and credentials but swaps the database name to
 * `<name>_test`, so the dev data in capstone_db is never touched.
 *
 * Refuses anything that isn't a localhost database ending in `_test`: the
 * suite truncates every table between tests, so pointing it at the wrong
 * database (e.g. a production URL in .env) must fail loudly instead.
 */
export function getTestDbUrl(): string {
  let url: URL;
  if (process.env.TEST_DATABASE_URL) {
    url = new URL(process.env.TEST_DATABASE_URL);
  } else {
    if (!process.env.DATABASE_URL) {
      throw new Error("Integration tests need TEST_DATABASE_URL or DATABASE_URL to be set");
    }
    url = new URL(process.env.DATABASE_URL);
    url.pathname = `${url.pathname.replace(/^\//, "")}_test`;
  }

  const dbName = url.pathname.replace(/^\//, "");
  if (!["localhost", "127.0.0.1", "::1"].includes(url.hostname) || !dbName.endsWith("_test")) {
    throw new Error(
      `Refusing to run integration tests against "${dbName}" on "${url.hostname}" — ` +
        "the test database must be on localhost and its name must end in _test.",
    );
  }
  return url.toString();
}
