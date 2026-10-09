// Server-side helpers for the first-party event log (see schema.events).
import { getDb, schema } from "../db/client";

type EventIn = typeof schema.events.$inferInsert;

// Crawlers and monitors would drown the signal; they never get logged.
const BOT_UA = /bot|crawl|spider|slurp|preview|monitor|uptime|headless|python-requests|curl|wget|httpclient|go-http|node-fetch|axios/i;
export const isBot = (ua: string | null) => !ua || BOT_UA.test(ua);

/** Lowercase, trim, collapse spaces, cap length. Searches are compared in this form. */
export const normalizeQuery = (q: string) => q.toLowerCase().replace(/\s+/g, " ").trim().slice(0, 80);

export async function logEvent(e: EventIn): Promise<void> {
  try {
    await getDb().insert(schema.events).values(e);
  } catch (err) {
    // Analytics must never break a page.
    console.error("logEvent failed:", (err as Error).message);
  }
}
