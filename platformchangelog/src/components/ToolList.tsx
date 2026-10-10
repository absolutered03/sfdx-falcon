"use client";
// The registry's tools pane: filter, category groups, current version per tool, and
// j / k (or arrow keys) to move through tools. The settled filter text is logged with
// its match count, as the old registry filter did.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { track } from "./Tracker";

export interface ToolRow {
  slug: string;
  name: string;
  kind: string;
  vendor: string | null;
  category: string;
  version: string | null;
  search: string; // lowercased name, slug, vendor, category label, description
}

export function ToolList({ tools, groups, current }: { tools: ToolRow[]; groups: [string, string][]; current?: string }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const lastLogged = useRef("");

  const term = q.trim().toLowerCase();
  const shown = useMemo(() => (term ? tools.filter((t) => t.search.includes(term)) : tools), [tools, term]);
  const order = useMemo(
    () => groups.flatMap(([c]) => shown.filter((t) => t.category === c).sort((a, b) => a.name.localeCompare(b.name))),
    [groups, shown],
  );

  useEffect(() => {
    if (term.length < 2) return;
    const t = setTimeout(() => {
      if (term === lastLogged.current) return;
      lastLogged.current = term;
      track({ type: "filter", path: "/tools", query: term, resultCount: shown.length });
    }, 1200);
    return () => clearTimeout(t);
  }, [term, shown.length]);

  useEffect(() => {
    list.current?.querySelector('[aria-current="true"]')?.scrollIntoView({ block: "nearest" });
  }, [current]);

  const move = (d: number) => {
    if (!order.length) return;
    const i = order.findIndex((t) => t.slug === current);
    const next = order[Math.min(order.length - 1, Math.max(0, i + d))];
    if (next) router.push(`/tools/${next.slug}`, { scroll: false });
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select") return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "j" || e.key === "ArrowDown") { e.preventDefault(); move(1); }
      else if (e.key === "k" || e.key === "ArrowUp") { e.preventDefault(); move(-1); }
      else if (e.key === "f") { e.preventDefault(); input.current?.focus(); }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  });

  return (
    <>
      <div className="filter">
        <label className="srlabel" htmlFor="f">Filter tools</label>
        <input
          ref={input}
          id="f"
          type="search"
          placeholder="filter by name, category, vendor"
          autoComplete="off"
          spellCheck={false}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") { e.preventDefault(); if (q) setQ(""); else input.current?.blur(); }
            else if (e.key === "ArrowDown") { e.preventDefault(); move(1); }
            else if (e.key === "ArrowUp") { e.preventDefault(); move(-1); }
            else if (e.key === "Enter" && order[0]) { e.preventDefault(); router.push(`/tools/${order[0].slug}`); }
          }}
        />
        <span className="cnt">{term ? `${shown.length} of ${tools.length}` : ""}</span>
      </div>
      <div className="pb" ref={list} role="listbox" aria-label="Tools">
        {!shown.length && <div className="lempty">No tool matches &quot;{q}&quot;. Try the search at the top; we log what people look for.</div>}
        {groups.map(([cat, label]) => {
          const group = order.filter((t) => t.category === cat);
          if (!group.length) return null;
          return (
            <div key={cat}>
              <div className="grp">{label} <span>{group.length}</span></div>
              {group.map((t) => (
                <Link
                  key={t.slug}
                  href={`/tools/${t.slug}`}
                  scroll={false}
                  className="trow"
                  role="option"
                  aria-current={t.slug === current ? "true" : "false"}
                  data-entity={t.slug}
                >
                  <span className="tn">{t.name}</span>
                  <span className="tv">{t.version ?? ""}</span>
                  {(t.kind !== "tool" || t.vendor) && (
                    <span className="tk">{t.kind !== "tool" ? t.kind.replace("_", " ") : ""}{t.kind !== "tool" && t.vendor ? " · " : ""}{t.vendor ?? ""}</span>
                  )}
                </Link>
              ))}
            </div>
          );
        })}
      </div>
    </>
  );
}
