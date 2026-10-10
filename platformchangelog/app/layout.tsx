import type { Metadata } from "next";
import type { ReactNode } from "react";
import { max } from "drizzle-orm";
import { getDb, schema } from "@/db/client";
import { getEntityList } from "@/lib/queries";
import { SITE_NAME, SITE_URL } from "@/lib/site";
import { Tracker } from "@/components/Tracker";
import { StatusLine } from "@/components/shell/StatusLine";
import { TopBar } from "@/components/shell/TopBar";
import "./globals.css";

// Every page shows live counts in the shell (tools tracked, when feeds were last read).
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: SITE_NAME, template: `%s | ${SITE_NAME}` },
  openGraph: { siteName: SITE_NAME, type: "website" },
  description:
    "What shipped in platform engineering, developer experience and DevOps, and what it changes for platform teams. Vendor-neutral, every entry linked to its source.",
};

// Applies the saved palette and light/dark choice before first paint, so a reload
// never flashes the default theme. localStorage only; no cookie.
const THEME_BOOT = `try{var p=localStorage.getItem('pcl-palette');if(p&&p!=='tokyo-night')document.documentElement.setAttribute('data-palette',p);var m=localStorage.getItem('pcl-mode');if(m==='light'||m==='dark')document.documentElement.setAttribute('data-theme',m)}catch(e){}`;

async function shellData() {
  try {
    const [tools, [fetched]] = await Promise.all([
      getEntityList(),
      getDb().select({ at: max(schema.sources.lastFetchedAt) }).from(schema.sources),
    ]);
    return { toolCount: tools.length, asOf: fetched?.at ? fetched.at.toISOString().slice(0, 16).replace("T", " ") + " UTC" : null };
  } catch {
    return { toolCount: 0, asOf: null }; // the shell still renders if the database is unreachable
  }
}

export default async function RootLayout({ children }: { children: ReactNode }) {
  const { toolCount, asOf } = await shellData();
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT }} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:ital,wght@0,400;0,500;0,600;1,400&family=IBM+Plex+Sans:wght@400;500;600&display=swap"
        />
      </head>
      <body>
        <div className="app">
          <TopBar toolCount={toolCount} />
          <Tracker />
          <main className="main">{children}</main>
          <StatusLine asOf={asOf} />
        </div>
      </body>
    </html>
  );
}
