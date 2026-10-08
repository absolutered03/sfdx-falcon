import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

// Reciprocity rule: allow crawlers that cite and link back (search and answer engines),
// block bulk training crawlers that ingest without sending readers.
const ANSWER_ENGINES = [
  "Googlebot", "Bingbot", "Applebot", "Google-Extended",
  "OAI-SearchBot", "ChatGPT-User", "PerplexityBot", "Perplexity-User",
  "ClaudeBot", "Claude-User", "Claude-SearchBot", "Claude-Web",
];
const TRAINING_CRAWLERS = [
  "GPTBot", "CCBot", "anthropic-ai", "Applebot-Extended", "Bytespider", "PetalBot",
  "Amazonbot", "Diffbot", "ImagesiftBot", "Omgilibot", "Timpibot", "Meta-ExternalAgent",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: ANSWER_ENGINES, allow: "/", disallow: "/admin" },
      { userAgent: TRAINING_CRAWLERS, disallow: "/" },
      { userAgent: "*", allow: "/", disallow: "/admin" },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
