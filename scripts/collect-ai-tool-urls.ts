#!/usr/bin/env bun
/**
 * Fast & Comprehensive AI Tool URL Collector
 *
 * Combines:
 * 1. Curated GitHub "Awesome AI" repositories (800+ top curated AI tools instantly)
 * 2. Firecrawl Web Search across 12 AI tool niches to fill the rest up to target (e.g. 1,000)
 *
 * Usage:
 *   bun run scripts/collect-ai-tool-urls.ts --target 1000 --output ./ai-tool-urls.txt
 *   docker compose exec app bun run scripts/collect-ai-tool-urls.ts --target 1000 --output /app/ai-tool-urls.txt
 */

import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname } from "node:path";
import { parseArgs } from "node:util";
import Firecrawl from "@mendable/firecrawl-js";

const { values } = parseArgs({
  args: process.argv.slice(2),
  options: {
    target: { type: "string", default: "1000" },
    output: { type: "string", default: "./ai-tool-urls.txt" },
    "skip-search": { type: "boolean", default: false },
  },
  strict: false,
});

const TARGET_COUNT = Number.parseInt(String(values.target ?? "1000"), 10);
const OUTPUT_FILE = String(values.output ?? "./ai-tool-urls.txt");
const SKIP_SEARCH = Boolean(values["skip-search"]);

// Curated high-quality GitHub Awesome AI lists with direct tool links
const GITHUB_AWESOME_AI_SOURCES = [
  {
    name: "mahseema/awesome-ai-tools",
    url: "https://raw.githubusercontent.com/mahseema/awesome-ai-tools/main/README.md",
  },
  {
    name: "steven2358/awesome-generative-ai",
    url: "https://raw.githubusercontent.com/steven2358/awesome-generative-ai/main/README.md",
  },
  {
    name: "e2b-dev/awesome-ai-agents",
    url: "https://raw.githubusercontent.com/e2b-dev/awesome-ai-agents/main/README.md",
  },
  {
    name: "tensorchord/Awesome-LLMOps",
    url: "https://raw.githubusercontent.com/tensorchord/Awesome-LLMOps/main/README.md",
  },
  {
    name: "ai-boost/awesome-prompts",
    url: "https://raw.githubusercontent.com/ai-boost/awesome-prompts/main/README.md",
  },
  {
    name: "formulahendry/awesome-gpt",
    url: "https://raw.githubusercontent.com/formulahendry/awesome-gpt/master/README.md",
  },
  {
    name: "humanloop/awesome-chatgpt",
    url: "https://raw.githubusercontent.com/humanloop/awesome-chatgpt/main/README.md",
  },
  {
    name: "f/awesome-chatgpt-prompts",
    url: "https://raw.githubusercontent.com/f/awesome-chatgpt-prompts/main/README.md",
  },
  {
    name: "hua1995116/awesome-ai-tools",
    url: "https://raw.githubusercontent.com/hua1995116/awesome-ai-tools/master/README.md",
  },
  {
    name: "altryne/awesome-ai-art-tools",
    url: "https://raw.githubusercontent.com/altryne/awesome-ai-art-tools/master/README.md",
  },
];

const IGNORED_HOSTS = new Set([
  "github.com",
  "github.io",
  "gitlab.com",
  "bitbucket.org",
  "twitter.com",
  "x.com",
  "linkedin.com",
  "facebook.com",
  "instagram.com",
  "youtube.com",
  "youtu.be",
  "discord.gg",
  "discord.com",
  "reddit.com",
  "medium.com",
  "wikipedia.org",
  "arxiv.org",
  "t.me",
  "telegram.org",
  "google.com",
  "apple.com",
  "play.google.com",
  "apps.apple.com",
  "chrome.google.com",
  "microsoft.com",
  "producthunt.com",
  "theresanaiforthat.com",
  "futurepedia.io",
  "toolify.ai",
  "altern.ai",
  "awesome.re",
  "shields.io",
  "badgen.net",
  "getrewardful.com",
  "pxf.io",
]);

function cleanToolUrl(rawUrl: string): string | null {
  try {
    const parsed = new URL(rawUrl.trim());
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }

    const hostname = parsed.hostname.toLowerCase().replace(/^www\./, "");
    if (
      IGNORED_HOSTS.has(hostname) ||
      hostname.endsWith(".github.io") ||
      hostname.includes("github") ||
      hostname.includes("twitter") ||
      hostname.includes("discord") ||
      hostname.includes("affiliate") ||
      hostname.includes("rewardful")
    ) {
      return null;
    }

    const path = parsed.pathname.toLowerCase();
    if (
      path.endsWith(".png") ||
      path.endsWith(".jpg") ||
      path.endsWith(".jpeg") ||
      path.endsWith(".svg") ||
      path.endsWith(".gif") ||
      path.endsWith(".pdf") ||
      path.endsWith(".ico")
    ) {
      return null;
    }

    // Strip search and hash
    parsed.search = "";
    parsed.hash = "";

    // Normalize: origin only for tools, or clean origin + path
    let cleaned = parsed.toString().replace(/\/+$/, "");
    return cleaned;
  } catch {
    return null;
  }
}

async function collectFromAwesomeGithub(
  collectedUrls: Set<string>,
  targetCount: number
): Promise<void> {
  console.log(`\n🚀 [Phase 1] Harvesting Curated GitHub Awesome AI Lists...`);

  for (const source of GITHUB_AWESOME_AI_SOURCES) {
    if (collectedUrls.size >= targetCount) break;

    try {
      process.stdout.write(`  📥 Fetching ${source.name}... `);
      const res = await fetch(source.url);
      if (!res.ok) {
        console.log(`(HTTP ${res.status})`);
        continue;
      }

      const markdown = await res.text();
      const linkRegex = /\[([^\]]+)\]\((https?:\/\/[^\s\)]+)\)/g;
      let match: RegExpExecArray | null;
      let addedFromSource = 0;

      while ((match = linkRegex.exec(markdown)) !== null) {
        if (collectedUrls.size >= targetCount) break;

        const candidate = cleanToolUrl(match[2]);
        if (candidate && !collectedUrls.has(candidate)) {
          collectedUrls.add(candidate);
          appendFileSync(OUTPUT_FILE, `${candidate}\n`);
          addedFromSource++;
        }
      }

      console.log(`+${addedFromSource} tools (Total: ${collectedUrls.size}/${targetCount})`);
    } catch (err) {
      console.log(`(Error: ${err instanceof Error ? err.message : err})`);
    }
  }
}

async function collectFromFirecrawlSearch(
  collectedUrls: Set<string>,
  targetCount: number
): Promise<void> {
  const apiKey = process.env.FIRECRAWL_API_KEY;
  if (!apiKey) {
    console.log(`\nℹ️ FIRECRAWL_API_KEY not found in environment, skipping search phase.`);
    return;
  }

  const firecrawl = new Firecrawl({ apiKey });
  console.log(`\n🔍 [Phase 2] Expanding with Firecrawl Search to reach ${targetCount} tools...`);

  const SEARCH_QUERIES = [
    "top AI coding assistants tools software",
    "best AI writing assistant copywriting tools",
    "best AI video generator avatar animation tools",
    "best AI voice generator text to speech tools",
    "best AI productivity workflow automation tools",
    "best AI image photo design generator software",
    "best AI agents autonomous browser tools",
    "best AI study research homework tutor tools",
    "best AI marketing SEO social media tools",
    "best AI customer support chatbot tools",
    "best AI finance accounting investing tools",
    "best AI 3D model generator rendering tools",
  ];

  for (const query of SEARCH_QUERIES) {
    if (collectedUrls.size >= targetCount) break;

    console.log(`  🔎 Searching: "${query}"...`);
    try {
      const searchRes = await firecrawl.search(query, {
        limit: 30,
        sources: ["web"],
      });

      if (!searchRes.success || !searchRes.data) continue;

      const items = Array.isArray(searchRes.data)
        ? searchRes.data
        : (searchRes.data as any).web || [];

      let added = 0;
      for (const item of items) {
        if (collectedUrls.size >= targetCount) break;
        const candidate = cleanToolUrl(item.url);
        if (candidate && !collectedUrls.has(candidate)) {
          collectedUrls.add(candidate);
          appendFileSync(OUTPUT_FILE, `${candidate}\n`);
          added++;
        }
      }
      console.log(`     +${added} tools (Total: ${collectedUrls.size}/${targetCount})`);
    } catch (err) {
      console.warn(`     ⚠️ Query error:`, err instanceof Error ? err.message : err);
    }
  }
}

async function main() {
  console.log("==================================================");
  console.log("🔥 AI Tool URL Collector (GitHub Awesome + Firecrawl)");
  console.log("==================================================");
  console.log(`🎯 Target URLs: ${TARGET_COUNT}`);
  console.log(`💾 Output file: ${OUTPUT_FILE}\n`);

  // Ensure output directory exists
  const outputDir = dirname(OUTPUT_FILE);
  if (outputDir && outputDir !== "." && !existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }

  const collectedUrls = new Set<string>();

  // Resume from existing file if present
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

  // Phase 1: GitHub Awesome AI Lists (fast, yields 800+ clean tools in seconds)
  if (collectedUrls.size < TARGET_COUNT) {
    await collectFromAwesomeGithub(collectedUrls, TARGET_COUNT);
  }

  // Phase 2: Firecrawl Search if more are needed
  if (collectedUrls.size < TARGET_COUNT && !SKIP_SEARCH) {
    await collectFromFirecrawlSearch(collectedUrls, TARGET_COUNT);
  }

  console.log("\n==================================================");
  console.log("🎉 Collection Complete!");
  console.log(`   Total URLs Collected: ${collectedUrls.size}`);
  console.log(`   Saved in:             ${OUTPUT_FILE}`);
  console.log("==================================================");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
