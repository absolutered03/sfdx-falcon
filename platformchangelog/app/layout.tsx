import type { Metadata } from "next";
import type { ReactNode } from "react";
import { SITE_NAME, SITE_URL } from "@/lib/site";
import { Tracker } from "@/components/Tracker";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: SITE_NAME, template: `%s | ${SITE_NAME}` },
  openGraph: { siteName: SITE_NAME, type: "website" },
  description:
    "What shipped in platform engineering, developer experience and DevOps, and what it changes for platform teams. Vendor-neutral, every entry linked to its source.",
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
          <form action="/search" role="search" className="site-search">
            <label htmlFor="site-search" className="sr-only">Search</label>
            <input id="site-search" name="q" type="search" placeholder="Search tools and releases" autoComplete="off" />
          </form>
        </header>
        <Tracker />
        <main>{children}</main>
        <footer className="site">
          Entries are summarized automatically from the linked public source and corrected when we get one wrong.{" "}
          <a href="/about">How this works</a>.
        </footer>
      </body>
    </html>
  );
}
