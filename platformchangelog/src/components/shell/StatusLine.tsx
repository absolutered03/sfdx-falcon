"use client";
// tmux-style status line: session, breadcrumb from the route, key hints, and when
// the feeds were last read.
import { usePathname } from "next/navigation";
import { Fragment } from "react";

function crumbs(path: string): string[] {
  if (path === "/") return ["feed"];
  if (path === "/about") return ["methodology"];
  const parts = path.split("/").filter(Boolean);
  if (parts[0] === "tools") return ["registry", ...parts.slice(1)];
  return parts;
}

export function StatusLine({ asOf }: { asOf: string | null }) {
  const path = usePathname();
  const parts = crumbs(path);
  return (
    <footer className="status" aria-label="Status line">
      <span className="sess">pcl</span>
      <span className="crumb">
        {parts.map((p, i) => (
          <Fragment key={i}>{i > 0 && <i>&rsaquo;</i>}<b>{decodeURIComponent(p)}</b></Fragment>
        ))}
      </span>
      <span className="keys">
        <span><b>/</b> search</span><span><b>1 2 3</b> workspace</span><span><b>j k</b> move</span>
        <span><b>enter</b> open</span><span><b>t</b> palette</span><span><b>esc</b> back</span>
      </span>
      {asOf && <span className="asof">feeds read {asOf}</span>}
    </footer>
  );
}
