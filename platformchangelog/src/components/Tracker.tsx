"use client";
// Cookieless page analytics: page views, visible time on page, and clicks on links
// that leave the site (to a release page, repo or vendor site). Sends small JSON
// beacons to /api/events. The only identifier is a random id kept in sessionStorage
// for this tab, so a visit can be counted without tracking a person.
import { usePathname } from "next/navigation";
import { useEffect } from "react";

function sessionId(): string | undefined {
  try {
    let id = sessionStorage.getItem("pcl-sid");
    if (!id) {
      id = Math.random().toString(36).slice(2, 12) + Date.now().toString(36);
      sessionStorage.setItem("pcl-sid", id);
    }
    return id;
  } catch {
    return undefined; // storage blocked: still count events, just not visits
  }
}

export function track(event: Record<string, unknown>) {
  try {
    const body = JSON.stringify({ ...event, sessionId: sessionId() });
    if (!navigator.sendBeacon?.("/api/events", body)) {
      void fetch("/api/events", { method: "POST", body, keepalive: true });
    }
  } catch {
    /* analytics never breaks the page */
  }
}

export function Tracker() {
  const path = usePathname();

  // Page view plus visible time on this page, sent when the visitor leaves it.
  useEffect(() => {
    if (path.startsWith("/admin")) return;
    track({ type: "pageview", path });
    let visibleSince = document.visibilityState === "visible" ? Date.now() : 0;
    let total = 0;
    let sent = false;
    const flush = () => {
      if (visibleSince) total += Date.now() - visibleSince;
      visibleSince = 0;
      if (!sent && total > 1000) {
        sent = true;
        track({ type: "engagement", path, durationMs: Math.round(total) });
      }
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") flush();
      else if (!sent) visibleSince = Date.now();
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", flush);
    return () => {
      flush();
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", flush);
    };
  }, [path]);

  // Outbound clicks: host only, plus the tool the link belongs to (data-entity).
  useEffect(() => {
    const onClick = (ev: MouseEvent) => {
      const a = (ev.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a) return;
      let url: URL;
      try {
        url = new URL(a.href, location.href);
      } catch {
        return;
      }
      if (!/^https?:$/.test(url.protocol) || url.host === location.host) return;
      const entity = (a.closest("[data-entity]") as HTMLElement | null)?.dataset.entity;
      track({ type: "outbound", path: location.pathname, targetHost: url.host, entitySlug: entity });
    };
    document.addEventListener("click", onClick, { capture: true });
    return () => document.removeEventListener("click", onClick, { capture: true });
  }, []);

  return null;
}
