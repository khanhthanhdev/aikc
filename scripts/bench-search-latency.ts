/**
 * Latency benchmark for local Qdrant + Infinity embedding (384 dims).
 *
 * Traces timing for every operation:
 *   - Embedding generation (single, batch, cold vs warm)
 *   - BM25 sparse tokenization
 *   - Qdrant upsert
 *   - Qdrant keyword search (sparse)
 *   - Qdrant semantic search (dense)
 *   - Qdrant hybrid search (RRF fusion)
 *   - Qdrant recommend (similar tools)
 *   - End-to-end search pipeline (embed + search)
 *
 * Usage:
 *   SKIP_ENV_VALIDATION=true bun run scripts/bench-search-latency.ts
 */

import crypto from "node:crypto";
import { QdrantClient } from "@qdrant/js-client-rest";
import { randomUUIDv7 } from "bun";

// ── Config ───────────────────────────────────────────────────────────────────

const QDRANT_URL = "http://localhost:6333";
const INFINITY_URL = "http://localhost:7997";
const MODEL = "sentence-transformers/all-MiniLM-L6-v2";
const DENSE_VECTOR_SIZE = 384;
const SPARSE_VOCAB_SIZE = 30_000;
const COLLECTION = "bench_latency";
const WARMUP_ROUNDS = 2;
const BENCH_ROUNDS = 5;

const qdrant = new QdrantClient({ url: QDRANT_URL, checkCompatibility: false });

// ── Helpers ──────────────────────────────────────────────────────────────────

const embed = async (texts: string[]): Promise<number[][]> => {
  const res = await fetch(`${INFINITY_URL}/embeddings`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: MODEL, input: texts }),
  });
  if (!res.ok) {
    throw new Error(`Embedding failed: ${res.status} ${await res.text()}`);
  }
  const json = await res.json();
  return json.data.map((d: { embedding: number[] }) => d.embedding);
};

const tokenize = (text: string): string[] =>
  text
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1);

const tokenToIndex = (token: string): number => {
  let hash = 0;
  for (let i = 0; i < token.length; i++) {
    hash = (hash << 5) - hash + token.charCodeAt(i);
    hash &= hash;
  }
  return Math.abs(hash) % SPARSE_VOCAB_SIZE;
};

const sparseEmbed = (text: string): { indices: number[]; values: number[] } => {
  const tokens = tokenize(text);
  const freq = new Map<number, number>();
  for (const t of tokens) {
    const idx = tokenToIndex(t);
    freq.set(idx, (freq.get(idx) ?? 0) + 1);
  }
  const docLen = tokens.length;
  const avgDocLen = 100;
  const k1 = 1.2;
  const b = 0.75;
  const indices: number[] = [];
  const values: number[] = [];
  for (const [idx, tf] of freq) {
    indices.push(idx);
    values.push(
      (tf * (k1 + 1)) / (tf + k1 * (1 - b + b * (docLen / avgDocLen)))
    );
  }
  return { indices, values };
};

const toUUID = (id: string): string => {
  const hash = crypto.createHash("md5").update(id).digest("hex");
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-${hash.slice(12, 16)}-${hash.slice(16, 20)}-${hash.slice(20, 32)}`;
};

// ── Timing utilities ─────────────────────────────────────────────────────────

interface TimingResult {
  avg: number;
  max: number;
  min: number;
  p50: number;
  p95: number;
  samples: number[];
}

const measure = async (
  fn: () => Promise<void>,
  rounds: number
): Promise<TimingResult> => {
  const samples: number[] = [];
  for (let i = 0; i < rounds; i++) {
    const t0 = performance.now();
    await fn();
    samples.push(performance.now() - t0);
  }
  samples.sort((a, b) => a - b);
  return {
    samples,
    min: samples[0],
    max: samples[samples.length - 1],
    avg: samples.reduce((a, b) => a + b, 0) / samples.length,
    p50: samples[Math.floor(samples.length * 0.5)],
    p95: samples[Math.floor(samples.length * 0.95)],
  };
};

const fmt = (ms: number): string => {
  if (ms < 1) {
    return `${(ms * 1000).toFixed(0)}µs`;
  }
  return `${ms.toFixed(2)}ms`;
};

const printTiming = (label: string, result: TimingResult) => {
  const bar = (ms: number, maxMs: number) => {
    const width = Math.round((ms / maxMs) * 30);
    return "█".repeat(Math.max(1, width));
  };
  const maxVal = Math.max(...allTimings.map((t) => t.result.avg), result.avg);

  console.log(
    `  ${label.padEnd(42)} avg=${fmt(result.avg).padStart(9)}  p50=${fmt(result.p50).padStart(9)}  p95=${fmt(result.p95).padStart(9)}  min=${fmt(result.min).padStart(9)}  max=${fmt(result.max).padStart(9)}`
  );
};

const allTimings: { label: string; result: TimingResult; category: string }[] =
  [];

const bench = async (
  category: string,
  label: string,
  fn: () => Promise<void>,
  rounds = BENCH_ROUNDS
): Promise<TimingResult> => {
  // Warmup
  for (let i = 0; i < WARMUP_ROUNDS; i++) {
    await fn();
  }
  const result = await measure(fn, rounds);
  allTimings.push({ label, result, category });
  printTiming(label, result);
  return result;
};

// ── Sample Data ──────────────────────────────────────────────────────────────

interface MockTool {
  categories: string[];
  description: string;
  id: string;
  name: string;
  slug: string;
  tagline: string;
  tags: string[];
}

const TOOLS: MockTool[] = [
  {
    id: randomUUIDv7(),
    slug: "notion",
    name: "Notion",
    tagline: "All-in-one workspace",
    description:
      "Notion is a productivity and note-taking web application that provides tools such as kanban boards, tasks, wikis, and databases.",
    categories: ["productivity", "note-taking"],
    tags: ["wiki", "docs", "kanban"],
  },
  {
    id: randomUUIDv7(),
    slug: "obsidian",
    name: "Obsidian",
    tagline: "A second brain for you",
    description:
      "Obsidian is a powerful knowledge base that works on top of a local folder of plain text Markdown files for note-taking and personal knowledge management.",
    categories: ["productivity", "note-taking"],
    tags: ["markdown", "knowledge-base", "pkm"],
  },
  {
    id: randomUUIDv7(),
    slug: "figma",
    name: "Figma",
    tagline: "Collaborative design tool",
    description:
      "Figma is a collaborative interface design tool for creating UI/UX designs, prototypes, and design systems in the browser.",
    categories: ["design", "prototyping"],
    tags: ["ui", "ux", "prototype", "collaboration"],
  },
  {
    id: randomUUIDv7(),
    slug: "vscode",
    name: "VS Code",
    tagline: "Code editing redefined",
    description:
      "Visual Studio Code is a free source-code editor by Microsoft with debugging, embedded Git, syntax highlighting, and extensions.",
    categories: ["developer-tools", "code-editor"],
    tags: ["editor", "ide", "extensions", "git"],
  },
  {
    id: randomUUIDv7(),
    slug: "linear",
    name: "Linear",
    tagline: "Software project management",
    description:
      "Linear is a project management tool for software teams to plan, track, and manage issues and product roadmaps.",
    categories: ["project-management", "developer-tools"],
    tags: ["issues", "roadmap", "agile"],
  },
  {
    id: randomUUIDv7(),
    slug: "slack",
    name: "Slack",
    tagline: "Team communication platform",
    description:
      "Slack is a messaging app for teams that brings all communication together with channels, direct messages, and integrations.",
    categories: ["communication", "collaboration"],
    tags: ["chat", "messaging", "team"],
  },
  {
    id: randomUUIDv7(),
    slug: "jira",
    name: "Jira",
    tagline: "Issue tracking for agile teams",
    description:
      "Jira is a proprietary issue tracking product by Atlassian for bug tracking, issue tracking, and agile project management.",
    categories: ["project-management"],
    tags: ["issues", "agile", "scrum", "bug-tracking"],
  },
  {
    id: randomUUIDv7(),
    slug: "canva",
    name: "Canva",
    tagline: "Design anything, publish anywhere",
    description:
      "Canva is a free-to-use online graphic design tool for creating social media posts, presentations, posters, and other visual content.",
    categories: ["design", "marketing"],
    tags: ["graphic-design", "templates", "social-media"],
  },
];

const buildToolDocument = (tool: MockTool): string =>
  [
    tool.name,
    tool.tagline,
    tool.description,
    tool.tags.join(", "),
    tool.categories.join(", "),
  ]
    .filter(Boolean)
    .join("\n\n");

// ── Main ─────────────────────────────────────────────────────────────────────

const run = async () => {
  console.log("⏱️  Search Latency Benchmark");
  console.log(`   Qdrant: ${QDRANT_URL}  |  Infinity: ${INFINITY_URL}`);
  console.log(`   Dims: ${DENSE_VECTOR_SIZE}  |  Model: ${MODEL}`);
  console.log(
    `   Warmup: ${WARMUP_ROUNDS} rounds  |  Bench: ${BENCH_ROUNDS} rounds`
  );
  console.log("");

  // ══════════════════════════════════════════════════════════════════════════
  // 1. EMBEDDING LATENCY
  // ══════════════════════════════════════════════════════════════════════════
  console.log("═".repeat(70));
  console.log("1️⃣  EMBEDDING LATENCY (Infinity local)");
  console.log("═".repeat(70));

  // Cold start — first request to model
  const t0Cold = performance.now();
  await embed(["cold start test"]);
  const coldMs = performance.now() - t0Cold;
  console.log(`  ⚡ Cold start (first request):              ${fmt(coldMs)}`);
  console.log("");

  // Single short text
  await bench("embedding", "Single embed: short text (5 words)", async () => {
    await embed(["project management tool"]);
  });

  // Single long text
  const longText = buildToolDocument(TOOLS[0]);
  await bench(
    "embedding",
    `Single embed: long text (${longText.length} chars)`,
    async () => {
      await embed([longText]);
    }
  );

  // Batch embeddings
  const batchTexts3 = TOOLS.slice(0, 3).map(buildToolDocument);
  await bench("embedding", "Batch embed: 3 texts", async () => {
    await embed(batchTexts3);
  });

  const batchTexts8 = TOOLS.map(buildToolDocument);
  await bench("embedding", "Batch embed: 8 texts", async () => {
    await embed(batchTexts8);
  });

  // BM25 sparse (in-process, no network)
  await bench("embedding", "BM25 sparse tokenize (in-process)", async () => {
    for (const tool of TOOLS) {
      sparseEmbed(buildToolDocument(tool));
    }
  });

  // ══════════════════════════════════════════════════════════════════════════
  // 2. QDRANT OPERATIONS LATENCY
  // ══════════════════════════════════════════════════════════════════════════
  console.log("\n" + "═".repeat(70));
  console.log("2️⃣  QDRANT OPERATIONS LATENCY");
  console.log("═".repeat(70));

  // Setup collection
  const setupCollection = async () => {
    const exists = await qdrant.collectionExists(COLLECTION);
    if (typeof exists === "boolean" ? exists : exists?.exists) {
      await qdrant.deleteCollection(COLLECTION);
    }
    await qdrant.createCollection(COLLECTION, {
      vectors: { dense: { size: DENSE_VECTOR_SIZE, distance: "Cosine" } },
      sparse_vectors: { sparse: { index: { on_disk: false } } },
    });
  };

  await setupCollection();

  // Pre-compute vectors for tools
  const toolDocs = TOOLS.map(buildToolDocument);
  const toolVecs = await embed(toolDocs);

  // Upsert single point
  await bench("qdrant", "Upsert: single point", async () => {
    const sparse = sparseEmbed(toolDocs[0]);
    await qdrant.upsert(COLLECTION, {
      wait: true,
      points: [
        {
          id: toUUID(TOOLS[0].id),
          vector: {
            dense: toolVecs[0],
            sparse: { indices: sparse.indices, values: sparse.values },
          },
          payload: {
            id: TOOLS[0].id,
            slug: TOOLS[0].slug,
            name: TOOLS[0].name,
          },
        },
      ],
    });
  });

  // Upsert batch (8 points)
  await bench("qdrant", "Upsert: batch (8 points)", async () => {
    const points = TOOLS.map((tool, i) => {
      const sparse = sparseEmbed(toolDocs[i]);
      return {
        id: toUUID(tool.id),
        vector: {
          dense: toolVecs[i],
          sparse: { indices: sparse.indices, values: sparse.values },
        },
        payload: {
          id: tool.id,
          slug: tool.slug,
          name: tool.name,
          tagline: tool.tagline,
          description: tool.description,
          categories: tool.categories,
          tags: tool.tags,
        },
      };
    });
    await qdrant.upsert(COLLECTION, { wait: true, points });
  });

  // Ensure data is indexed — final upsert with wait
  const finalPoints = TOOLS.map((tool, i) => {
    const sparse = sparseEmbed(toolDocs[i]);
    return {
      id: toUUID(tool.id),
      vector: {
        dense: toolVecs[i],
        sparse: { indices: sparse.indices, values: sparse.values },
      },
      payload: {
        id: tool.id,
        slug: tool.slug,
        name: tool.name,
        tagline: tool.tagline,
        description: tool.description,
        categories: tool.categories,
        tags: tool.tags,
      },
    };
  });
  await qdrant.upsert(COLLECTION, { wait: true, points: finalPoints });

  // Create payload index
  await qdrant.createPayloadIndex(COLLECTION, {
    field_name: "categories",
    field_schema: "keyword",
  });

  // Point retrieval
  await bench("qdrant", "Retrieve: single point by ID", async () => {
    await qdrant.retrieve(COLLECTION, {
      ids: [toUUID(TOOLS[0].id)],
      with_payload: true,
      with_vector: true,
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // 3. SEARCH LATENCY (Qdrant only, vectors pre-computed)
  // ══════════════════════════════════════════════════════════════════════════
  console.log("\n" + "═".repeat(70));
  console.log("3️⃣  SEARCH LATENCY (Qdrant only, pre-computed vectors)");
  console.log("═".repeat(70));

  // Pre-compute query vectors
  const queryTexts = [
    "project management software",
    "note-taking knowledge base",
    "design UI prototyping",
    "team communication chat",
    "code editor IDE",
  ];
  const queryVecs = await embed(queryTexts);
  const querySparseVecs = queryTexts.map(sparseEmbed);

  // Keyword search (sparse only)
  await bench("search", "Keyword search (sparse, limit=3)", async () => {
    await qdrant.query(COLLECTION, {
      query: {
        indices: querySparseVecs[0].indices,
        values: querySparseVecs[0].values,
      },
      using: "sparse",
      limit: 3,
      with_payload: true,
    });
  });

  // Semantic search (dense only)
  await bench("search", "Semantic search (dense, limit=3)", async () => {
    await qdrant.query(COLLECTION, {
      query: queryVecs[0],
      using: "dense",
      limit: 3,
      with_payload: true,
    });
  });

  // Semantic search (dense, limit=10)
  await bench("search", "Semantic search (dense, limit=10)", async () => {
    await qdrant.query(COLLECTION, {
      query: queryVecs[0],
      using: "dense",
      limit: 10,
      with_payload: true,
    });
  });

  // Hybrid search (RRF fusion)
  await bench(
    "search",
    "Hybrid search (RRF, prefetch=20, limit=5)",
    async () => {
      await qdrant.query(COLLECTION, {
        prefetch: [
          { query: queryVecs[0], using: "dense", limit: 20 },
          {
            query: {
              indices: querySparseVecs[0].indices,
              values: querySparseVecs[0].values,
            },
            using: "sparse",
            limit: 20,
          },
        ],
        query: { fusion: "rrf" },
        limit: 5,
        with_payload: true,
      });
    }
  );

  // Filtered search
  await bench(
    "search",
    "Filtered search (dense + category filter)",
    async () => {
      await qdrant.query(COLLECTION, {
        query: queryVecs[2],
        using: "dense",
        limit: 5,
        with_payload: true,
        filter: {
          must: [{ key: "categories", match: { any: ["design"] } }],
        },
      });
    }
  );

  // Recommend (similar tools)
  await bench("search", "Recommend (similar tools, limit=5)", async () => {
    await qdrant.query(COLLECTION, {
      query: {
        recommend: {
          positive: [toUUID(TOOLS[0].id)],
          negative: [],
        },
      },
      using: "dense",
      limit: 5,
      with_payload: true,
    });
  });

  // Multiple queries in sequence
  await bench("search", "5 sequential semantic searches", async () => {
    for (let i = 0; i < queryVecs.length; i++) {
      await qdrant.query(COLLECTION, {
        query: queryVecs[i],
        using: "dense",
        limit: 5,
        with_payload: true,
      });
    }
  });

  // ══════════════════════════════════════════════════════════════════════════
  // 4. END-TO-END PIPELINE LATENCY (embed + search combined)
  // ══════════════════════════════════════════════════════════════════════════
  console.log("\n" + "═".repeat(70));
  console.log("4️⃣  END-TO-END PIPELINE LATENCY (embed → search)");
  console.log("═".repeat(70));

  // Full semantic search pipeline
  await bench("e2e", "E2E: embed + semantic search (limit=5)", async () => {
    const [vec] = await embed(["best project management tool"]);
    await qdrant.query(COLLECTION, {
      query: vec,
      using: "dense",
      limit: 5,
      with_payload: true,
    });
  });

  // Full hybrid search pipeline
  await bench("e2e", "E2E: embed + hybrid search (RRF, limit=5)", async () => {
    const query = "productivity note taking app";
    const [denseVec] = await embed([query]);
    const sparseVec = sparseEmbed(query);
    await qdrant.query(COLLECTION, {
      prefetch: [
        { query: denseVec, using: "dense", limit: 20 },
        {
          query: {
            indices: sparseVec.indices,
            values: sparseVec.values,
          },
          using: "sparse",
          limit: 20,
        },
      ],
      query: { fusion: "rrf" },
      limit: 5,
      with_payload: true,
    });
  });

  // Full pipeline: embed + hybrid + filtered
  await bench("e2e", "E2E: embed + hybrid + category filter", async () => {
    const query = "design interface mockups";
    const [denseVec] = await embed([query]);
    const sparseVec = sparseEmbed(query);
    await qdrant.query(COLLECTION, {
      prefetch: [
        {
          query: denseVec,
          using: "dense",
          limit: 20,
          filter: {
            must: [{ key: "categories", match: { any: ["design"] } }],
          },
        },
        {
          query: {
            indices: sparseVec.indices,
            values: sparseVec.values,
          },
          using: "sparse",
          limit: 20,
          filter: {
            must: [{ key: "categories", match: { any: ["design"] } }],
          },
        },
      ],
      query: { fusion: "rrf" },
      limit: 5,
      with_payload: true,
    });
  });

  // Full upsert pipeline: embed + sparse + upsert
  await bench("e2e", "E2E: embed + sparse + upsert (1 tool)", async () => {
    const doc = buildToolDocument(TOOLS[0]);
    const [denseVec] = await embed([doc]);
    const sparseVec = sparseEmbed(doc);
    await qdrant.upsert(COLLECTION, {
      wait: true,
      points: [
        {
          id: toUUID(TOOLS[0].id),
          vector: {
            dense: denseVec,
            sparse: {
              indices: sparseVec.indices,
              values: sparseVec.values,
            },
          },
          payload: { id: TOOLS[0].id, slug: TOOLS[0].slug },
        },
      ],
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // 5. BREAKDOWN: Where time is spent in a typical search
  // ══════════════════════════════════════════════════════════════════════════
  console.log("\n" + "═".repeat(70));
  console.log("5️⃣  BREAKDOWN: Typical hybrid search pipeline");
  console.log("═".repeat(70));

  const query = "best tool for managing software projects";

  // Measure each phase
  const tTotal0 = performance.now();

  const tEmbed0 = performance.now();
  const [breakdownVec] = await embed([query]);
  const embedMs = performance.now() - tEmbed0;

  const tSparse0 = performance.now();
  const breakdownSparse = sparseEmbed(query);
  const sparseMs = performance.now() - tSparse0;

  const tSearch0 = performance.now();
  const breakdownResults = await qdrant.query(COLLECTION, {
    prefetch: [
      { query: breakdownVec, using: "dense", limit: 20 },
      {
        query: {
          indices: breakdownSparse.indices,
          values: breakdownSparse.values,
        },
        using: "sparse",
        limit: 20,
      },
    ],
    query: { fusion: "rrf" },
    limit: 5,
    with_payload: true,
  });
  const searchMs = performance.now() - tSearch0;
  const totalMs = performance.now() - tTotal0;

  const pctEmbed = ((embedMs / totalMs) * 100).toFixed(1);
  const pctSparse = ((sparseMs / totalMs) * 100).toFixed(1);
  const pctSearch = ((searchMs / totalMs) * 100).toFixed(1);

  console.log(`\n  Query: "${query}"`);
  console.log(`  Results: ${breakdownResults.points.length} points\n`);

  const maxMs = Math.max(embedMs, sparseMs, searchMs);
  const barWidth = 40;
  const bar = (ms: number) =>
    "█".repeat(Math.max(1, Math.round((ms / maxMs) * barWidth)));

  console.log(
    `  Dense embed:   ${bar(embedMs)} ${fmt(embedMs).padStart(9)}  (${pctEmbed}%)`
  );
  console.log(
    `  Sparse BM25:   ${bar(sparseMs)} ${fmt(sparseMs).padStart(9)}  (${pctSparse}%)`
  );
  console.log(
    `  Qdrant search: ${bar(searchMs)} ${fmt(searchMs).padStart(9)}  (${pctSearch}%)`
  );
  console.log(`  ${"─".repeat(barWidth + 2)}`);
  console.log(
    `  Total:         ${" ".repeat(barWidth - 7)} ${fmt(totalMs).padStart(9)}  (100%)`
  );

  // ── Cleanup ────────────────────────────────────────────────────────────
  console.log("\n🧹 Cleanup");
  await qdrant.deleteCollection(COLLECTION);
  console.log("  ✅ Collection deleted");

  // ══════════════════════════════════════════════════════════════════════════
  // SUMMARY TABLE
  // ══════════════════════════════════════════════════════════════════════════
  console.log("\n" + "═".repeat(90));
  console.log("📊 SUMMARY TABLE");
  console.log("═".repeat(90));
  console.log(
    `  ${"Operation".padEnd(44)} ${"Avg".padStart(9)}  ${"P50".padStart(9)}  ${"P95".padStart(9)}  ${"Min".padStart(9)}  ${"Max".padStart(9)}`
  );
  console.log(`  ${"─".repeat(86)}`);

  let lastCategory = "";
  for (const { label, result, category } of allTimings) {
    if (category !== lastCategory) {
      lastCategory = category;
      console.log(`  ${category.toUpperCase().padEnd(86)}`);
    }
    console.log(
      `  ${label.padEnd(44)} ${fmt(result.avg).padStart(9)}  ${fmt(result.p50).padStart(9)}  ${fmt(result.p95).padStart(9)}  ${fmt(result.min).padStart(9)}  ${fmt(result.max).padStart(9)}`
    );
  }
  console.log("═".repeat(90));
};

run().catch((err) => {
  console.error("💥 Fatal error:", err);
  process.exit(1);
});
