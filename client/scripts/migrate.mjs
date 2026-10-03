// Runs `prisma migrate deploy` as the first step of `npm run build` — but
// not on a Vercel Preview build unless Preview has its own database. Every
// pushed branch and Dependabot PR gets a Preview build, so migrating a
// database Preview shares with Production would apply an unreviewed
// branch's migrations to production.
//
// Set PREVIEW_DATABASE_ISOLATED=true in Vercel (Preview environment only)
// once Preview's DATABASE_URL/DIRECT_URL point at a separate database;
// Preview builds then keep that database's schema up to date. Never set it
// while Preview still shares Production's database. Production deploys,
// local builds and CI always migrate.
import { execSync } from "node:child_process";

if (process.env.VERCEL_ENV === "preview" && process.env.PREVIEW_DATABASE_ISOLATED !== "true") {
  console.log(
    "Skipping `prisma migrate deploy` on a Vercel Preview build: Preview's database isn't marked as separate " +
      "from Production (PREVIEW_DATABASE_ISOLATED=true).",
  );
  process.exit(0);
}

execSync("prisma migrate deploy", { stdio: "inherit" });
