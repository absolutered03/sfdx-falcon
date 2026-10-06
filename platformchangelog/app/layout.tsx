import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Platform Changelog", template: "%s | Platform Changelog" },
  description:
    "What shipped in platform engineering, developer experience and DevOps, and what it changes for platform teams. Vendor-neutral, human-reviewed.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="site">
          <a href="/" className="brand">Platform Changelog</a>
          <nav>
            <a href="/">Feed</a>
            <a href="/tools">Registry</a>
            <a href="/about">Methodology</a>
          </nav>
        </header>
        <main>{children}</main>
        <footer className="site">
          Every entry is drafted by software from a public source and reviewed by a person before it appears.{" "}
          <a href="/about">How this works</a>.
        </footer>
      </body>
    </html>
  );
}
