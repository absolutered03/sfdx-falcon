import { existsSync } from "node:fs";
import { defineConfig } from "drizzle-kit";

// Same .env the app and scripts use (Next.js loads it itself; drizzle-kit does not).
if (existsSync(".env")) process.loadEnvFile(".env");

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url: process.env.DATABASE_URL! },
});
