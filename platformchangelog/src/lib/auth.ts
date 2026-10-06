// HTTP Basic auth for /admin. The public site has no accounts; this is the only gate.
// Checked in proxy.ts for page loads and again inside every server action, because a
// server action can be POSTed from any route, not only the page that renders it.

export function isAuthorized(authHeader: string | null): boolean {
  const user = process.env.ADMIN_USER;
  const pass = process.env.ADMIN_PASSWORD;
  if (!user || !pass || !authHeader?.startsWith("Basic ")) return false;
  const [u, p] = atob(authHeader.slice(6)).split(":");
  return u === user && p === pass;
}
