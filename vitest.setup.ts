// Load the app's .env before any test module is imported. Several _core
// modules (env.ts, db.ts, auth.ts) read required env vars at module load, so
// without this `pnpm test` fails with "Missing required env var: DATABASE_URL"
// even though the dev server runs fine. dotenv does not override variables
// already present in the environment, so CI-provided values still win.
import "dotenv/config";
