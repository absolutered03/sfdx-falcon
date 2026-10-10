// Launcher search for the top bar: tools, releases and change lines as one ranked list.
// With log=1 (sent once the query has settled for 1.2 s) the query is recorded with its
// tool count, which feeds "searched for, not covered" in /admin/tools.
import { NextResponse, type NextRequest } from "next/server";
import { isBot, logEvent, normalizeQuery } from "@/lib/analytics";
import { searchSite } from "@/lib/queries";

export const dynamic = "force-dynamic";

const anchor = (v: string | null) => (v ? `#v${v.replace(/^v/i, "")}` : "");

export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get("q") ?? "").slice(0, 200);
  const { tools, releases, changes } = await searchSite(q);

  if (req.nextUrl.searchParams.get("log") === "1") {
    if (q.trim().length >= 2 && !isBot(req.headers.get("user-agent"))) {
      await logEvent({ type: "search", path: "/search", query: normalizeQuery(q), resultCount: tools.length });
    }
    return new NextResponse(null, { status: 204 });
  }

  const results = [
    ...tools.slice(0, 6).map((t) => ({ k: "tool" as const, href: `/tools/${t.slug}`, name: t.name, version: t.current?.version ?? null, description: t.description })),
    ...releases.slice(0, 8).map((r) => ({
      k: "release" as const,
      href: `/tools/${r.slug}${anchor(r.item.version)}`,
      name: r.name,
      version: r.item.version ?? "",
      date: r.item.publishedAt.toISOString().slice(0, 10),
      title: r.item.title,
    })),
    ...changes.slice(0, 10).map((c) => ({ k: "change" as const, href: `/tools/${c.slug}${anchor(c.version)}`, name: c.name, version: c.version, type: c.type, breaking: c.breaking, text: c.text })),
  ];
  return NextResponse.json({ results }, { headers: { "cache-control": "no-store" } });
}
