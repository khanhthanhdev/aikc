#!/usr/bin/env bun
/**
 * Collect AI Tool URLs across diverse categories/purposes using Firecrawl Search.
 *
 * It searches top AI tool directories & queries across multiple niches (Coding, Writing,
 * Audio, Video, Image, Marketing, Research, Productivity, Study, Finance, etc.), extracts
 * clean target URLs, deduplicates them, and writes them to an output file.
 *
 * Usage:
 *   bun --env-file=.env.production run scripts/collect-ai-tool-urls.ts --target 1000 --output ./ai-tool-urls.txt
 *   bun --env-file=.env.production run scripts/collect-ai-tool-urls.ts --target 5 --output ./test-5-urls.txt
 */

import { appendFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { parseArgs } from "node:util";
import Firecrawl from "@mendable/firecrawl-js";

const { values } = parseArgs({
  args: process.argv.slice(2),
  options: {
    target: { type: "string", default: "1000" },
    output: { type: "string", default: "./ai-tool-urls.txt" },
    limit: { type: "string", default: "20" },
  },
  strict: false,
});

const TARGET_COUNT = Number.parseInt(String(values.target ?? "1000"), 10);
const OUTPUT_FILE = String(values.output ?? "./ai-tool-urls.txt");
const PER_SEARCH_LIMIT = Math.min(
  Number.parseInt(String(values.limit ?? "20"), 10),
  100
);

const apiKey = process.env.FIRECRAWL_API_KEY;
if (!apiKey) {
  console.error("❌ Error: FIRECRAWL_API_KEY is not set in environment.");
  process.exit(1);
}

const firecrawl = new Firecrawl({ apiKey });

// Comprehensive queries across many AI purposes & categories
const CATEGORY_QUERIES = [
  // Developer & Coding
  "best AI developer tools code completion debugging site:theresanaiforthat.com/ai/ OR site:futurepedia.io/tool/",
  "AI coding assistant code generator code review site:theresanaiforthat.com/ai/ OR site:futurepedia.io/tool/",
  "AI terminal devops database SQL site:theresanaiforthat.com/ai/ OR site:futurepedia.io/tool/",
  "AI API testing automation backend site:theresanaiforthat.com/ai/ OR site:futurepedia.io/tool/",

  // Writing & Copywriting
  "best AI writing assistant copywriting blog essay site:theresanaiforthat.com/ai/ OR site:futurepedia.io/tool/",
  "AI grammar paraphrasing novel story writing site:theresanaiforthat.com/ai/ OR site:futurepedia.io/tool/",
  "AI email writer documentation technical writing site:theresanaiforthat.com/ai/ OR site:futurepedia.io/tool/",

  // Design, Image & 3D
  "best AI image generator photo editing graphic design site:theresanaiforthat.com/ai/ OR site:futurepedia.io/tool/",
  "AI logo generator vector art design site:theresanaiforthat.com/ai/ OR site:futurepedia.io/tool/",
  "AI 3D model generator animation rendering site:theresanaiforthat.com/ai/ OR site:futurepedia.io/tool/",

  // Video & Animation
  "best AI video generator avatar text to video site:theresanaiforthat.com/ai/ OR site:futurepedia.io/tool/",
  "AI video editing clip maker shorts reels site:theresanaiforthat.com/ai/ OR site:futurepedia.io/tool/",
  "AI subtitle caption translation video site:theresanaiforthat.com/ai/ OR site:futurepedia.io/tool/",

  // Audio, Voice & Music
  "best AI voice generator text to speech voice cloning site:theresanaiforthat.com/ai/ OR site:futurepedia.io/tool/",
  "AI music generator song audio production site:theresanaiforthat.com/ai/ OR site:futurepedia.io/tool/",
  "AI podcast editor noise reduction audio site:theresanaiforthat.com/ai/ OR site:futurepedia.io/tool/",

  // Research, Learning & Study
  "best AI study tools research assistant academic paper site:theresanaiforthat.com/ai/ OR site:futurepedia.io/tool/",
  "AI flashcard quiz generator homework tutor site:theresanaiforthat.com/ai/ OR site:futurepedia.io/tool/",
  "AI literature review citation PDF summarizer site:theresanaiforthat.com/ai/ OR site:futurepedia.io/tool/",

  // Productivity & Workflow
  "best AI productivity tools task management meeting notes site:theresanaiforthat.com/ai/ OR site:futurepedia.io/tool/",
  "AI workflow automation agents browser automation site:theresanaiforthat.com/ai/ OR site:futurepedia.io/tool/",
  "AI knowledge base document search second brain site:theresanaiforthat.com/ai/ OR site:futurepedia.io/tool/",

  // Business, Sales & Marketing
  "best AI marketing tools SEO social media scheduling site:theresanaiforthat.com/ai/ OR site:futurepedia.io/tool/",
  "AI CRM customer support chatbot sales outreach site:theresanaiforthat.com/ai/ OR site:futurepedia.io/tool/",
  "AI market research competitor analysis site:theresanaiforthat.com/ai/ OR site:futurepedia.io/tool/",

  // Finance, Legal & HR
  "best AI finance tools bookkeeping accounting investing site:theresanaiforthat.com/ai/ OR site:futurepedia.io/tool/",
  "AI legal assistant contract review compliance site:theresanaiforthat.com/ai/ OR site:futurepedia.io/tool/",
  "AI recruiting resume screening talent acquisition site:theresanaiforthat.com/ai/ OR site:futurepedia.io/tool/",

  // Healthcare, Wellness & Lifestyle
  "best AI health fitness nutrition mental health site:theresanaiforthat.com/ai/ OR site:futurepedia.io/tool/",
  "AI travel planner personal assistant site:theresanaiforthat.com/ai/ OR site:futurepedia.io/tool/",
];

const IGNORED_DOMAINS = new Set([
  "theresanaiforthat.com",
  "futurepedia.io",
  "google.com",
  "facebook.com",
  "twitter.com",
  "x.com",
  "linkedin.com",
  "instagram.com",
  "youtube.com",
  "getrewardful.com",
  "pxf.io",
  "reddit.com",
  "wikipedia.org",
  "medium.com",
]);

function cleanUrl(rawUrl: string): string | null {
  try {
    const parsed = new URL(rawUrl);
    // Strip UTM & tracking parameters
    parsed.searchParams.delete("utm_source");
    parsed.searchParams.delete("utm_medium");
    parsed.searchParams.delete("utm_campaign");
    parsed.searchParams.delete("ref");
    parsed.searchParams.delete("ref_source");
    parsed.searchParams.delete("elvn");
    parsed.searchParams.delete("fid");

    const hostname = parsed.hostname.toLowerCase().replace(/^www\./, "");
    if (
      IGNORED_DOMAINS.has(hostname) ||
      hostname.includes("theresanaiforthat") ||
      hostname.includes("futurepedia") ||
      hostname.includes("rewardful") ||
      hostname.includes("affiliate")
    ) {
      return null;
    }

    // Keep origin + pathname (cleaned)
    parsed.hash = "";
    return parsed.toString();
  } catch {
    return null;
  }
}

async function extractToolUrlFromDirectoryPage(directoryUrl: string): Promise<string | null> {
  try {
    const scrapeRes = await firecrawl.scrapeUrl(directoryUrl, {
      formats: ["links"],
    });

    if (!scrapeRes.success || !Array.isArray(scrapeRes.links)) {
      return null;
    }

    // Look for external link to tool's official website
    for (const link of scrapeRes.links) {
      if (typeof link !== "string" || !link.startsWith("http")) continue;
      const cleaned = cleanUrl(link);
      if (cleaned) {
        return cleaned;
      }
    }
  } catch (error) {
    // Non-fatal, continue with next
  }
  return null;
}

async function main() {
  console.log("==================================================");
  console.log("🔍 AI Tool URL Collector via Firecrawl");
  console.log("==================================================");
  console.log(`🎯 Target URLs:  ${TARGET_COUNT}`);
  console.log(`💾 Output file:  ${OUTPUT_FILE}`);
  console.log(`📦 Categories:   ${CATEGORY_QUERIES.length} search queries\n`);

  const collectedUrls = new Set<string>();

  // Load existing URLs if output file exists to support resuming
  if (existsSync(OUTPUT_FILE)) {
    const existing = readFileSync(OUTPUT_FILE, "utf8")
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0 && !l.startsWith("#"));
    for (const u of existing) {
      collectedUrls.add(u);
    }
    console.log(`📂 Loaded ${collectedUrls.size} existing URLs from ${OUTPUT_FILE}`);
  }

  let queryIndex = 0;

  while (collectedUrls.size < TARGET_COUNT && queryIndex < CATEGORY_QUERIES.length) {
    const query = CATEGORY_QUERIES[queryIndex];
    queryIndex++;

    console.log(`\n--------------------------------------------------`);
    console.log(`[Query ${queryIndex}/${CATEGORY_QUERIES.length}] "${query.slice(0, 50)}..."`);
    console.log(`Progress: ${collectedUrls.size}/${TARGET_COUNT} URLs collected`);

    try {
      const searchRes = await firecrawl.search(query, {
        limit: PER_SEARCH_LIMIT,
        sources: ["web"],
      });

      if (!searchRes.success || !searchRes.data) {
        console.warn(`  ⚠️ Search returned no data or failed.`);
        continue;
      }

      const items = Array.isArray(searchRes.data)
        ? searchRes.data
        : (searchRes.data as any).web || [];

      console.log(`  Found ${items.length} directory entries`);

      for (const item of items) {
        if (collectedUrls.size >= TARGET_COUNT) break;

        const dirUrl = item.url;
        if (!dirUrl) continue;

        // Scrape directory page to find direct product URL
        const directUrl = await extractToolUrlFromDirectoryPage(dirUrl);
        if (directUrl && !collectedUrls.has(directUrl)) {
          collectedUrls.add(directUrl);
          appendFileSync(OUTPUT_FILE, `${directUrl}\n`);
          console.log(`  ➕ [${collectedUrls.size}/${TARGET_COUNT}] ${directUrl}`);
        }
      }
    } catch (err) {
      console.warn(
        `  ⚠️ Query failed:`,
        err instanceof Error ? err.message : err
      );
    }
  }

  console.log("\n==================================================");
  console.log("🎉 URL Collection Finished");
  console.log(`   Total URLs: ${collectedUrls.size}`);
  console.log(`   Saved to:   ${OUTPUT_FILE}`);
  console.log("==================================================");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
