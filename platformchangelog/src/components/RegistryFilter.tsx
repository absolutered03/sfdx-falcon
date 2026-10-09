"use client";
// Instant filter for the registry list. Hides rows and empty category sections in
// place, and logs the settled filter text with its match count (what people look
// for in the registry, and what they fail to find).
import { useEffect, useRef, useState } from "react";
import { track } from "./Tracker";

export function RegistryFilter() {
  const [q, setQ] = useState("");
  const [count, setCount] = useState<number | null>(null);
  const lastLogged = useRef("");

  useEffect(() => {
    const term = q.trim().toLowerCase();
    let shown = 0;
    document.querySelectorAll<HTMLElement>("[data-registry-section]").forEach((section) => {
      let inSection = 0;
      section.querySelectorAll<HTMLElement>("[data-search]").forEach((row) => {
        const hit = !term || row.dataset.search!.includes(term);
        row.hidden = !hit;
        if (hit) inSection++;
      });
      section.hidden = inSection === 0;
      shown += inSection;
    });
    setCount(term ? shown : null);

    if (term.length < 2) return;
    const timer = setTimeout(() => {
      if (term === lastLogged.current) return;
      lastLogged.current = term;
      track({ type: "filter", path: "/tools", query: term, resultCount: shown });
    }, 1200);
    return () => clearTimeout(timer);
  }, [q]);

  return (
    <div className="registry-filter">
      <label htmlFor="registry-filter">Filter tools</label>
      <input
        id="registry-filter"
        type="search"
        placeholder="name, category or vendor"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        autoComplete="off"
      />
      {count !== null && <span className="meta">{count === 0 ? "No tools match. Try the site search." : `${count} shown`}</span>}
    </div>
  );
}
