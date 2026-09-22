#!/usr/bin/env bun
/**
 * Mass Crawl & Ingest Script using Firecrawl
 *
 * 1. Crawls or scrapes URLs using Firecrawl (extracting structured metadata + screenshot in 1 call).
 * 2. Uploads screenshot & favicon to Cloudflare R2 directly.
 * 3. Creates/updates the Tool record in PostgreSQL via Prisma.
 * 4. Generates Vietnamese translation (via Gemini/translation pipeline).
 * 5. Syncs the tool to Qdrant vector store (Dense + Sparse BM25 hybrid search).
 * 6. Optionally triggers traditional pipeline Inngest event ("tool.submitted").
 *
 * Usage:
 *   bun run scripts/firecrawl-mass-crawl.ts --urls "https://example.com,https://github.com"
 *   bun run scripts/firecrawl-mass-crawl.ts --file ./urls.txt
 *   bun run scripts/firecrawl-mass-crawl.ts --crawl "https://docs.example.com" --limit 10
 *   bun run scripts/firecrawl-mass-crawl.ts --urls "https://github.com" --trigger-inngest
 *   bun run scripts/firecrawl-mass-crawl.ts --urls "https://github.com" --dry-run
 */

import { readFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { Upload } from "@aws-sdk/lib-storage";
import { slugify, stripURLSubpath } from "@curiousleaf/utils";
import type { Prisma } from "@prisma/client";
import { env } from "~/env";
import { translateToVietnamese } from "~/lib/translate-content";
import { upsertHybridToolVector } from "~/lib/vector-store";
import { firecrawlClient } from "~/services/firecrawl";
import { sendInngestEvent } from "~/services/inngest";
import { prisma } from "~/services/prisma";
import { r2Client } from "~/services/r2";

const { values } = parseArgs({
  args: process.argv.slice(2),
  options: {
    urls: { type: "string" },
    file: { type: "string" },
    crawl: { type: "string" },
    limit: { type: "string", default: "10" },
    "dry-run": { type: "boolean", default: false },
    "trigger-inngest": { type: "boolean", default: false },
    "skip-translation": { type: "boolean", default: false },
    "skip-vector": { type: "boolean", default: false },
  },
  strict: false,
});

const DRY_RUN = Boolean(values["dry-run"]);
const TRIGGER_INNGEST = Boolean(values["trigger-inngest"]);
const SKIP_TRANSLATION = Boolean(values["skip-translation"]);
const SKIP_VECTOR = Boolean(values["skip-vector"]);
const CRAWL_LIMIT = Number.parseInt(String(values.limit ?? "10"), 10);

interface FirecrawlExtraction {
  content?: string;
  description?: string;
  name?: string;
  pricing?: string;
  tagline?: string;
  tags?: string[];
}

const R2_CACHE_CONTROL = "public, max-age=31536000, immutable";

const getR2PublicUrl = (key: string): string =>
  new URL(
    key.split("/").map(encodeURIComponent).join("/"),
    `${env.R2_PUBLIC_URL.replace(/\/+$/, "")}/`
  ).toString();

const uploadBufferToR2 = async (
  file: Buffer,
  key: string,
  contentType?: string
): Promise<string> => {
  const upload = new Upload({
    client: r2Client,
    params: {
      Bucket: env.R2_BUCKET,
      Key: key,
      Body: file,
      ContentType: contentType,
      CacheControl: R2_CACHE_CONTROL,
    },
    queueSize: 4,
    partSize: 1024 * 1024 * 5,
    leavePartsOnError: false,
  });

  await upload.done();
  return getR2PublicUrl(key);
};

const fetchAndUploadFavicon = async (
  url: string,
  storageKey: string
): Promise<string> => {
  const cleanedUrl = encodeURIComponent(stripURLSubpath(url) ?? "");
  const faviconUrl = `https://www.google.com/s2/favicons?sz=128&domain_url=${cleanedUrl}`;

  const res = await fetch(faviconUrl);
  if (!res.ok) {
    throw new Error(`Failed to fetch favicon: ${res.statusText}`);
  }
  const arrayBuffer = await res.arrayBuffer();
  return await uploadBufferToR2(
    Buffer.from(arrayBuffer),
    `${storageKey}.png`,
    "image/png"
  );
};

const EXTRACTION_PROMPT = `
Extract structured product metadata for a software directory:
- name: The clean, canonical product/service name (e.g. "GitHub", "Notion", "Linear").
- tagline: A crisp tagline under 60 characters highlighting the value proposition. Do not repeat the name.
- description: A concise description under 160 characters describing what it does.
- content: An engaging, detailed overview (up to 800 characters) covering key features and practical use cases. Use standard markdown paragraphs and bullet points.
- pricing: The pricing model (e.g., 'Free', 'Freemium', 'Paid', 'From $10/mo', 'Open Source'). Keep it short.
- tags: Up to 6 short, lowercase, hyphen-separated tags (e.g., 'developer-tools', 'productivity', 'ai-assistant').
`;

const EXTRACTION_SCHEMA = {
  type: "object",
  properties: {
    name: { type: "string" },
    tagline: { type: "string" },
    description: { type: "string" },
    content: { type: "string" },
    pricing: { type: "string" },
    tags: {
      type: "array",
      items: { type: "string" },
    },
  },
  required: ["name", "tagline", "description", "content", "pricing", "tags"],
};

/**
 * Generates a unique slug in Prisma by appending numeric suffixes if taken.
 */
async function generateUniqueSlug(baseName: string): Promise<string> {
  const baseSlug = slugify(baseName) || "tool";
  let slug = baseSlug;
  let suffix = 2;

  while (true) {
    const existing = await prisma.tool.findUnique({
      where: { slug },
      select: { id: true },
    });
    if (!existing) {
      return slug;
    }
    slug = `${baseSlug}-${suffix}`;
    suffix++;
  }
}

/**
 * Downloads a screenshot from Firecrawl signed URL and stores it in R2.
 */
async function uploadScreenshotFromUrl(
  screenshotUrl: string,
  slug: string
): Promise<string | null> {
  try {
    const res = await fetch(screenshotUrl);
    if (!res.ok) {
      console.warn(
        `  ⚠️ Failed to download screenshot from Firecrawl (${res.status}): ${screenshotUrl}`
      );
      return null;
    }
    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const key = `tools/${slug}/screenshot.png`;
    const r2Url = await uploadBufferToR2(buffer, key, "image/png");
    return `${r2Url}?v=${Date.now()}`;
  } catch (error) {
    console.warn(
      `  ⚠️ Error uploading screenshot to R2 for ${slug}:`,
      error instanceof Error ? error.message : error
    );
    return null;
  }
}

/**
 * Scrapes a single URL with Firecrawl, extracting JSON + screenshot.
 */
async function scrapeAndIngestUrl(targetUrl: string) {
  console.log(`\n🌐 Processing URL: ${targetUrl}`);

  if (DRY_RUN) {
    console.log(`  🔍 [DRY RUN] Scraping & extracting with Firecrawl (JSON + Screenshot)...`);
    const scrapeResponse = await firecrawlClient.scrapeUrl(targetUrl, {
      formats: ["json", "screenshot"],
      jsonOptions: {
        prompt: EXTRACTION_PROMPT,
        schema: EXTRACTION_SCHEMA,
      },
    });

    if (!scrapeResponse.success) {
      throw new Error(
        `Firecrawl scrape failed: ${scrapeResponse.error ?? "Unknown error"}`
      );
    }

    const extracted = (scrapeResponse.json ?? {}) as FirecrawlExtraction;
    const name =
      extracted.name?.trim() ||
      scrapeResponse.metadata?.title?.split(/[-|·]/)[0]?.trim() ||
      new URL(targetUrl).hostname.replace(/^www\./, "");
    const slug = slugify(name) || "tool";

    console.log(`  ✨ Extracted tool: "${name}" (slug: ${slug})`);
    console.log(`  📝 Tagline: ${extracted.tagline ?? "N/A"}`);
    console.log(`  📄 Description: ${extracted.description ?? "N/A"}`);
    console.log(`  🏷️  Tags: ${(extracted.tags ?? []).join(", ")}`);
    console.log(`  💰 Pricing: ${extracted.pricing ?? "N/A"}`);
    console.log(`  📸 Screenshot: ${scrapeResponse.screenshot ? "Found" : "None"}`);
    console.log(`  [DRY RUN] Skipping database write, R2 upload, and indexing.`);
    return { status: "dry-run", name, slug };
  }

  // Check if tool with this websiteUrl already exists
  const existingTool = await prisma.tool.findUnique({
    where: { websiteUrl: targetUrl },
  });

  if (existingTool) {
    console.log(`  ℹ️ Tool already exists in DB: ${existingTool.slug} (${existingTool.name})`);
    if (TRIGGER_INNGEST) {
      console.log(`  🚀 Triggering Inngest event 'tool.submitted' for existing tool...`);
      await sendInngestEvent({
        name: "tool.submitted",
        data: { id: existingTool.id, slug: existingTool.slug },
      });
    }
    return { status: "exists", tool: existingTool };
  }

  console.log(`  🔍 Scraping & extracting with Firecrawl (JSON + Screenshot)...`);
  const scrapeResponse = await firecrawlClient.scrapeUrl(targetUrl, {
    formats: ["json", "screenshot"],
    jsonOptions: {
      prompt: EXTRACTION_PROMPT,
      schema: EXTRACTION_SCHEMA,
    },
  });

  if (!scrapeResponse.success) {
    throw new Error(
      `Firecrawl scrape failed: ${scrapeResponse.error ?? "Unknown error"}`
    );
  }

  const extracted = (scrapeResponse.json ?? {}) as FirecrawlExtraction;
  const name =
    extracted.name?.trim() ||
    scrapeResponse.metadata?.title?.split(/[-|·]/)[0]?.trim() ||
    new URL(targetUrl).hostname.replace(/^www\./, "");
  const slug = await generateUniqueSlug(name);

  console.log(`  ✨ Extracted tool: "${name}" (slug: ${slug})`);
  console.log(`  📝 Tagline: ${extracted.tagline ?? "N/A"}`);
  console.log(`  🏷️  Tags: ${(extracted.tags ?? []).join(", ")}`);
  console.log(`  💰 Pricing: ${extracted.pricing ?? "N/A"}`);

  // 1. Upload screenshot & favicon to Cloudflare R2
  let screenshotUrl: string | null = null;
  if (scrapeResponse.screenshot) {
    console.log(`  📸 Uploading screenshot to Cloudflare R2...`);
    screenshotUrl = await uploadScreenshotFromUrl(scrapeResponse.screenshot, slug);
  }

  let faviconUrl: string | null = null;
  try {
    console.log(`  🎨 Uploading favicon to Cloudflare R2...`);
    faviconUrl = await fetchAndUploadFavicon(targetUrl, `tools/${slug}/favicon`);
  } catch (faviconError) {
    console.warn(
      `  ⚠️ Favicon fetch failed:`,
      faviconError instanceof Error ? faviconError.message : faviconError
    );
  }

  // 2. Prepare tags connectOrCreate
  const tagsList = (extracted.tags ?? [])
    .map((tag) => slugify(tag))
    .filter(Boolean);

  const toolCreateData: Prisma.ToolCreateInput = {
    name,
    slug,
    websiteUrl: targetUrl,
    tagline: extracted.tagline ?? null,
    description: extracted.description ?? null,
    content: extracted.content ?? null,
    pricing: extracted.pricing ?? null,
    screenshotUrl,
    faviconUrl,
    submitterName: "Firecrawl Mass Ingest",
    submitterEmail: "system@aikc.vn",
    publishedAt: new Date(),
    tags: {
      connectOrCreate: tagsList.map((tagSlug) => ({
        where: { slug: tagSlug },
        create: { name: tagSlug, slug: tagSlug },
      })),
    },
  };

  // 3. Create Tool in database
  console.log(`  💾 Saving to database...`);
  let createdTool = await prisma.tool.create({
    data: toolCreateData,
  });

  // 4. Vietnamese Translation
  if (!SKIP_TRANSLATION) {
    try {
      console.log(`  🇻🇳 Generating Vietnamese translation...`);
      const translation = await translateToVietnamese({
        name: createdTool.name,
        tagline: createdTool.tagline,
        description: createdTool.description,
        content: createdTool.content,
        pricing: createdTool.pricing,
      });

      createdTool = await prisma.tool.update({
        where: { id: createdTool.id },
        data: {
          ...translation,
          translationStatusVi: "MACHINE",
          translationUpdatedAtVi: new Date(),
        },
      });
      console.log(`  ✓ Vietnamese translation saved.`);
    } catch (transError) {
      console.warn(
        `  ⚠️ Translation failed (non-fatal):`,
        transError instanceof Error ? transError.message : transError
      );
    }
  }

  // 5. Sync to Qdrant Hybrid Vector Store
  if (!SKIP_VECTOR) {
    try {
      console.log(`  ⚡ Syncing to Qdrant vector store (dense + BM25 sparse)...`);
      const fullTool = await prisma.tool.findUniqueOrThrow({
        where: { id: createdTool.id },
        include: {
          categories: { select: { slug: true, name: true } },
          tags: { select: { slug: true } },
        },
      });
      await upsertHybridToolVector(fullTool);
      console.log(`  ✓ Synced to Qdrant hybrid collection.`);
    } catch (vecError) {
      console.warn(
        `  ⚠️ Vector store sync failed (non-fatal):`,
        vecError instanceof Error ? vecError.message : vecError
      );
    }
  }

  // 6. Optional: Trigger Inngest event for traditional downstream pipeline
  if (TRIGGER_INNGEST) {
    console.log(`  🚀 Sending 'tool.submitted' event to Inngest...`);
    await sendInngestEvent({
      name: "tool.submitted",
      data: { id: createdTool.id, slug: createdTool.slug },
    });
    console.log(`  ✓ Inngest event dispatched.`);
  }

  console.log(`  ✅ Successfully ingested: ${createdTool.slug}`);
  return { status: "created", tool: createdTool };
}

/**
 * Discovers URLs from a root domain using Firecrawl's crawl or map endpoint.
 */
async function discoverUrlsFromCrawl(rootUrl: string, limit: number): Promise<string[]> {
  console.log(`\n🕷️ Crawling root domain: ${rootUrl} (limit: ${limit})...`);
  const crawlRes = await firecrawlClient.crawlUrl(rootUrl, {
    limit,
    scrapeOptions: {
      formats: ["links"],
    },
  });

  if (!crawlRes.success) {
    throw new Error(`Crawl failed: ${crawlRes.error ?? "Unknown error"}`);
  }

  // Firecrawl crawl returns an array of crawled pages in crawlRes.data
  const urls: string[] = [];
  if (Array.isArray(crawlRes.data)) {
    for (const page of crawlRes.data) {
      const pageUrl = (page as any).metadata?.sourceURL || (page as any).url;
      if (pageUrl && !urls.includes(pageUrl)) {
        urls.push(pageUrl);
      }
    }
  }

  return urls.slice(0, limit);
}

async function main() {
  console.log("==================================================");
  console.log("🔥 AIKC Firecrawl Mass Ingestion Pipeline");
  console.log("==================================================");

  let targetUrls: string[] = [];

  if (values.crawl) {
    const rootUrl = String(values.crawl);
    targetUrls = await discoverUrlsFromCrawl(rootUrl, CRAWL_LIMIT);
  } else if (values.urls) {
    targetUrls = String(values.urls)
      .split(",")
      .map((u) => u.trim())
      .filter((u) => u.length > 0);
  } else if (values.file) {
    const fileContent = readFileSync(String(values.file), "utf8");
    targetUrls = fileContent
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0 && !line.startsWith("#"));
  } else {
    console.error(`
❌ Error: Please specify target URLs to process.

Options:
  --urls "https://example.com,https://github.com"   Comma-separated list of URLs
  --file "./urls.txt"                               Text file with 1 URL per line
  --crawl "https://directory.com/tools"             Crawl root domain
  --limit 10                                        Max URLs to crawl (default: 10)
  --trigger-inngest                                 Dispatch Inngest 'tool.submitted' event
  --dry-run                                         Simulate scrape without DB/R2 writes
  --skip-translation                                Skip Vietnamese translation step
  --skip-vector                                     Skip Qdrant vector indexing
`);
    process.exit(1);
  }

  console.log(`📋 Total URLs to process: ${targetUrls.length}`);
  console.log(`🔧 Mode: ${DRY_RUN ? "DRY RUN" : "ACTIVE INGESTION"}`);
  console.log(`🚀 Inngest event: ${TRIGGER_INNGEST ? "ENABLED" : "OFF"}`);

  const results = {
    total: targetUrls.length,
    created: 0,
    exists: 0,
    failed: 0,
  };

  for (let i = 0; i < targetUrls.length; i++) {
    const url = targetUrls[i];
    console.log(`\n--------------------------------------------------`);
    console.log(`[${i + 1}/${targetUrls.length}] Ingesting: ${url}`);
    try {
      const res = await scrapeAndIngestUrl(url);
      if (res.status === "created") results.created++;
      else if (res.status === "exists") results.exists++;
    } catch (err) {
      results.failed++;
      console.error(
        `  ❌ Failed to process ${url}:`,
        err instanceof Error ? err.message : err
      );
    }
  }

  console.log("\n==================================================");
  console.log("📊 Summary Report");
  console.log(`   Total URLs:  ${results.total}`);
  console.log(`   ✅ Created:   ${results.created}`);
  console.log(`   ℹ️  Existing:  ${results.exists}`);
  console.log(`   ❌ Failed:    ${results.failed}`);
  console.log("==================================================");
}

main()
  .catch((err) => {
    console.error("Fatal error:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
