// Re-checks admin credentials inside server actions: a server action can be POSTed
// from any route, so the /admin proxy check alone is not enough.
import { headers } from "next/headers";
import { isAuthorized } from "./auth";

export async function assertAdmin() {
  if (!isAuthorized((await headers()).get("authorization"))) throw new Error("Unauthorized");
}
