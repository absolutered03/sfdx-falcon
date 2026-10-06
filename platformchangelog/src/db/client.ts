import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export type Db = PostgresJsDatabase<typeof schema>;

// Lazy so `next build` can import pages without a database. Cached on globalThis
// because Next.js dev reloads modules and would otherwise leak connections.
const g = globalThis as unknown as { db?: Db };

export function getDb(): Db {
  if (g.db) return g.db;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  g.db = drizzle({ client: postgres(url, { max: 5 }), schema });
  return g.db;
}

export { schema };
