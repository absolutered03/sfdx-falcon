import type { ReactNode } from "react";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <nav className="filters" aria-label="Admin">
        <a href="/admin">Audit</a>
        <a href="/admin/insights">Insights</a>
        <a href="/admin/tools">Tools</a>
      </nav>
      {children}
    </>
  );
}
