// Beacon endpoint for client-side events: registry filters, outbound clicks, page
// views and time on page. Searches are logged server-side by /search instead.
import { z } from "zod";
import { isBot, logEvent, normalizeQuery } from "@/lib/analytics";

const Event = z.object({
  type: z.enum(["filter", "outbound", "pageview", "engagement"]),
  sessionId: z.string().regex(/^[a-z0-9]{8,32}$/).optional(),
  path: z.string().max(200).optional(),
  query: z.string().max(200).optional(),
  resultCount: z.number().int().min(0).max(100000).optional(),
  entitySlug: z.string().regex(/^[a-z0-9-]{1,80}$/).optional(),
  targetHost: z.string().max(253).optional(),
  durationMs: z.number().int().min(0).max(4 * 3600_000).optional(),
});

// Crude per-instance rate limit: enough to stop a runaway client, not an abuser.
// Keyed on the client address for one minute, then forgotten; nothing is stored.
const hits = new Map<string, { n: number; reset: number }>();
function limited(key: string): boolean {
  const now = Date.now();
  const h = hits.get(key);
  if (!h || h.reset < now) {
    hits.set(key, { n: 1, reset: now + 60_000 });
    if (hits.size > 10_000) hits.clear();
    return false;
  }
  return ++h.n > 120;
}

export async function POST(req: Request) {
  if (isBot(req.headers.get("user-agent"))) return new Response(null, { status: 204 });
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (limited(ip)) return new Response(null, { status: 429 });

  let body: unknown;
  try {
    body = JSON.parse(await req.text()); // sendBeacon posts text/plain
  } catch {
    return new Response(null, { status: 400 });
  }
  const parsed = Event.safeParse(body);
  if (!parsed.success) return new Response(null, { status: 400 });
  const e = parsed.data;
  await logEvent({
    ...e,
    query: e.query ? normalizeQuery(e.query) : undefined,
    targetHost: e.targetHost?.toLowerCase(),
  });
  return new Response(null, { status: 204 });
}
