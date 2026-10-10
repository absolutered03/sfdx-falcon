import Link from "next/link";
import type { ReactNode } from "react";

// Admin pages render inside one pane of the tiling shell, with their own scroll.
export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="ws ws-single">
      <section className="pane">
        <div className="ph">
          <span className="pt">admin</span>
          <span className="sp" />
          <nav className="admin-nav" aria-label="Admin">
            <Link className="chipl" href="/admin">audit</Link>
            <Link className="chipl" href="/admin/insights">insights</Link>
            <Link className="chipl" href="/admin/tools">tools</Link>
          </nav>
        </div>
        <div className="pb pbp"><div className="doc wide">{children}</div></div>
      </section>
    </div>
  );
}
