// Runs `prisma migrate deploy` as the first step of `npm run build` — but
// not on Vercel Preview builds. Every pushed branch and Dependabot PR gets a
// Preview build, and Preview has database credentials configured, so
// migrating there would apply an unreviewed branch's migrations to whatever
// database Preview points at (in this project, historically production).
// Production deploys, local builds and CI still migrate as before.
import { execSync } from "node:child_process";

if (process.env.VERCEL_ENV === "preview") {
  console.log("Skipping `prisma migrate deploy` on a Vercel Preview build; migrations run on Production deploys only.");
  process.exit(0);
}

execSync("prisma migrate deploy", { stdio: "inherit" });
