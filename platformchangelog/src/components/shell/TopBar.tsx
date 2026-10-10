"use client";
// The top bar from the design prototype: brand, numbered workspaces, a launcher-style
// search and the palette controls. Search results come from /api/search as you type;
// enter opens the selected result, or the full results page when nothing is selected.
// The settled query is logged once (what people look for, and what they fail to find).
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { SIGIL, TOKEN } from "@/lib/release-view";

export const PALETTES = ["tokyo-night", "catppuccin", "gruvbox", "nord", "everforest", "kanagawa", "rose-pine"] as const;

type Result =
  | { k: "tool"; href: string; name: string; version: string | null; description: string }
  | { k: "release"; href: string; name: string; version: string; date: string; title: string }
  | { k: "change"; href: string; name: string; version: string; type: string; breaking: boolean; text: string };

const WORKSPACES = [
  { n: 1, label: "feed", href: "/", match: (p: string) => p === "/" },
  { n: 2, label: "registry", href: "/tools", match: (p: string) => p.startsWith("/tools") },
  { n: 3, label: "methodology", href: "/about", match: (p: string) => p === "/about" },
];

function Highlight({ text, q }: { text: string; q: string }) {
  if (!q) return <>{text}</>;
  const i = text.toLowerCase().indexOf(q.toLowerCase());
  if (i < 0) return <>{text}</>;
  return <>{text.slice(0, i)}<mark>{text.slice(i, i + q.length)}</mark>{text.slice(i + q.length)}</>;
}

function setPaletteAttr(p: string) {
  const root = document.documentElement;
  if (p === "tokyo-night") root.removeAttribute("data-palette");
  else root.setAttribute("data-palette", p);
  try { localStorage.setItem("pcl-palette", p); } catch { /* storage blocked: palette lasts for this page */ }
}

export function TopBar({ toolCount }: { toolCount: number }) {
  const pathname = usePathname();
  const router = useRouter();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Result[] | null>(null);
  const [sel, setSel] = useState(0);
  const [palette, setPalette] = useState<string>("tokyo-night");
  const input = useRef<HTMLInputElement>(null);
  const lastLogged = useRef("");

  useEffect(() => {
    try { setPalette(localStorage.getItem("pcl-palette") ?? "tokyo-night"); } catch { /* default palette */ }
  }, []);

  // Results as you type.
  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) { setResults(null); return; }
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(term)}`, { signal: ctrl.signal })
        .then((r) => r.json())
        .then((d: { results: Result[] }) => { setResults(d.results); setSel(0); })
        .catch(() => {});
    }, 120);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [q]);

  // Log the settled query once, server-side, with its tool count.
  useEffect(() => {
    const term = q.trim().toLowerCase();
    if (term.length < 2) return;
    const t = setTimeout(() => {
      if (term === lastLogged.current) return;
      lastLogged.current = term;
      fetch(`/api/search?q=${encodeURIComponent(term)}&log=1`).catch(() => {});
    }, 1200);
    return () => clearTimeout(t);
  }, [q]);

  const close = useCallback(() => { setResults(null); }, []);
  const open = useCallback((r?: Result) => {
    const term = q.trim();
    setQ(""); setResults(null); input.current?.blur();
    if (r) router.push(r.href);
    else if (term) router.push(`/search?q=${encodeURIComponent(term)}`);
  }, [q, router]);

  const cyclePalette = useCallback(() => {
    setPalette((cur) => {
      const next = PALETTES[(PALETTES.indexOf(cur as (typeof PALETTES)[number]) + 1) % PALETTES.length];
      setPaletteAttr(next);
      return next;
    });
  }, []);

  const toggleMode = () => {
    const root = document.documentElement;
    const cur = root.getAttribute("data-theme");
    const isDark = cur ? cur === "dark" : !window.matchMedia?.("(prefers-color-scheme: light)").matches;
    const next = isDark ? "light" : "dark";
    root.setAttribute("data-theme", next);
    try { localStorage.setItem("pcl-mode", next); } catch { /* lasts for this page */ }
  };

  // Global keys: / search, 1 2 3 workspaces, t palette, esc close.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select" || (e.target as HTMLElement)?.isContentEditable) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "/") { e.preventDefault(); input.current?.focus(); input.current?.select(); }
      else if (e.key === "1" || e.key === "2" || e.key === "3") router.push(WORKSPACES[Number(e.key) - 1].href);
      else if (e.key === "t") cyclePalette();
      else if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [router, cyclePalette, close]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (!t.closest(".results") && !t.closest(".search")) close();
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, [close]);

  const groups: [Result["k"], string][] = [["tool", "tools"], ["release", "releases"], ["change", "change lines"]];
  const term = q.trim();

  return (
    <>
      <header className="top">
        <Link className="brand" href="/" aria-label="Platform Changelog, go to feed">
          <span className="tiles" aria-hidden="true"><i /><i /><i /><i /></span>
          <span>platformchangelog<span className="tld">.dev</span></span>
        </Link>
        <nav className="ws-nav" aria-label="Workspaces">
          {WORKSPACES.map((w) => (
            <Link key={w.n} className="ws-btn" href={w.href} aria-current={w.match(pathname) ? "true" : "false"}>
              <span className="n">{w.n}</span><span className="lb">{w.label}</span>
            </Link>
          ))}
        </nav>
        <form
          className="search"
          role="search"
          action="/search"
          onSubmit={(e) => { e.preventDefault(); open(results?.[sel]); }}
        >
          <span className="pr" aria-hidden="true">&gt;</span>
          <label className="srlabel" htmlFor="q">Search tools, versions and changes</label>
          <input
            ref={input}
            id="q"
            name="q"
            type="search"
            placeholder="search tools, versions, changes"
            autoComplete="off"
            spellCheck={false}
            aria-controls="results"
            aria-expanded={results ? "true" : "false"}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              const n = results?.length ?? 0;
              if (e.key === "Escape") { e.preventDefault(); if (q) { setQ(""); close(); } else input.current?.blur(); }
              else if (n && (e.key === "ArrowDown" || (e.ctrlKey && e.key === "j"))) { e.preventDefault(); setSel((s) => (s + 1) % n); }
              else if (n && (e.key === "ArrowUp" || (e.ctrlKey && e.key === "k"))) { e.preventDefault(); setSel((s) => (s - 1 + n) % n); }
            }}
          />
          <kbd aria-hidden="true">/</kbd>
        </form>
        <div className="top-right">
          <span className="chip toolcount">{toolCount} tools</span>
          <label className="srlabel" htmlFor="palette">Palette</label>
          <select className="sel" id="palette" value={palette} onChange={(e) => { setPalette(e.target.value); setPaletteAttr(e.target.value); }}>
            {PALETTES.map((p) => <option key={p} value={p}>{p.replace("-", " ")}</option>)}
          </select>
          <button className="ib" type="button" title="Toggle light and dark" aria-label="Toggle light and dark" onClick={toggleMode}>
            <svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeWidth="1.5" /><path d="M8 2a6 6 0 0 0 0 12z" fill="currentColor" /></svg>
          </button>
        </div>
      </header>

      {results && (
        <div className="pane results" id="results" role="listbox" aria-label="Search results">
          <div className="ph">
            <span className="pt">search</span>
            <span className="pn">{results.length ? `${results.length} result${results.length === 1 ? "" : "s"}` : ""}</span>
            <span className="sp" />
            <span className="hint"><kbd>&uarr;</kbd> <kbd>&darr;</kbd> move <kbd>enter</kbd> open <kbd>esc</kbd> close</span>
          </div>
          <div className="pb">
            {results.length === 0 && (
              <div className="rempty">No match for &quot;{term}&quot; in tool names, descriptions, versions or change lines. Press enter for the full search.</div>
            )}
            {groups.map(([k, label]) => {
              const rows = results.map((r, i) => ({ r, i })).filter((x) => x.r.k === k);
              if (!rows.length) return null;
              return (
                <div key={k}>
                  <div className="rgroup">{label}</div>
                  {rows.map(({ r, i }) => (
                    <Link
                      key={i}
                      href={r.href}
                      className="rrow"
                      role="option"
                      aria-selected={i === sel ? "true" : "false"}
                      onClick={(e) => { e.preventDefault(); open(r); }}
                    >
                      <span className="rk">{r.k}</span>
                      <span className="rt">
                        {r.k === "tool" && <><Highlight text={r.name} q={term} /> <span className="rm">{r.version ?? ""}</span><br /><span className="rm"><Highlight text={r.description} q={term} /></span></>}
                        {r.k === "release" && <>{r.name} <Highlight text={r.version} q={term} /><br /><span className="rm">{r.date}{r.title ? ` · ${r.title}` : ""}</span></>}
                        {r.k === "change" && (
                          <>
                            <span className="sg" style={{ color: TOKEN[r.type] ? `var(--${TOKEN[r.type]})` : "var(--mute)" }}>{r.breaking ? "!" : SIGIL[r.type]}</span>
                            <Highlight text={r.text} q={term} /><br />
                            <span className="rm">{r.name} {r.version} &middot; {r.type}{r.breaking ? " · breaking" : ""}</span>
                          </>
                        )}
                      </span>
                    </Link>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}
