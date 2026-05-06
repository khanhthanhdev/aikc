/**
 * End-to-end test for search features using local Qdrant + Infinity (384 dims).
 *
 * Tests:
 *   1. Keyword search (BM25 sparse vectors)
 *   2. Semantic search (dense embeddings + hybrid RRF fusion)
 *   3. Similar tool suggestions (Qdrant recommend API)
 *
 * Prerequisites:
 *   - Qdrant running on http://localhost:6333
 *   - Infinity embedding server running on http://localhost:7997
 *
 * Usage:
 *   SKIP_ENV_VALIDATION=true bun run scripts/test-search-features.ts
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

const TEST_HYBRID_COLLECTION = "test_tools_hybrid";
const TEST_ALT_COLLECTION = "test_alternatives_hybrid";
const TEST_CAT_COLLECTION = "test_categories_hybrid";

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

const embedOne = async (text: string): Promise<number[]> => {
  const [vec] = await embed([text]);
  return vec;
};

// BM25-style sparse embedding (matches lib/vector-store.ts logic)
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

const cosine = (a: number[], b: number[]): number => {
  let dot = 0;
  let nA = 0;
  let nB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    nA += a[i] * a[i];
    nB += b[i] * b[i];
  }
  return dot / (Math.sqrt(nA) * Math.sqrt(nB));
};

let passed = 0;
let failed = 0;
const assert = (label: string, ok: boolean, detail?: string) => {
  if (ok) {
    passed++;
    console.log(`  ✅ ${label}`);
  } else {
    failed++;
    console.log(`  ❌ ${label}${detail ? ` — ${detail}` : ""}`);
  }
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

const CATEGORIES = [
  {
    id: randomUUIDv7(),
    slug: "productivity",
    name: "Productivity",
    description: "Tools to help you stay organized and get more done",
  },
  {
    id: randomUUIDv7(),
    slug: "design",
    name: "Design",
    description:
      "Design tools for creating interfaces, graphics, and visual content",
  },
  {
    id: randomUUIDv7(),
    slug: "developer-tools",
    name: "Developer Tools",
    description:
      "Tools for software development, debugging, and code management",
  },
  {
    id: randomUUIDv7(),
    slug: "project-management",
    name: "Project Management",
    description:
      "Tools for planning, tracking, and managing software projects and teams",
  },
];

// ── Collection Setup ─────────────────────────────────────────────────────────

const createHybridCollection = async (name: string) => {
  const exists = await qdrant.collectionExists(name);
  if (typeof exists === "boolean" ? exists : exists?.exists) {
    await qdrant.deleteCollection(name);
  }
  await qdrant.createCollection(name, {
    vectors: { dense: { size: DENSE_VECTOR_SIZE, distance: "Cosine" } },
    sparse_vectors: { sparse: { index: { on_disk: false } } },
  });
};

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

// ── Tests ────────────────────────────────────────────────────────────────────

const run = async () => {
  console.log("🧪 Search Features Integration Test");
  console.log(`   Qdrant: ${QDRANT_URL}  |  Infinity: ${INFINITY_URL}`);
  console.log(`   Dense dims: ${DENSE_VECTOR_SIZE}  |  Tools: ${TOOLS.length}`);
  console.log("");

  // ────────────────────────────────────────────────────────────────────────
  // SETUP: Create collections & index tools
  // ────────────────────────────────────────────────────────────────────────
  console.log("📦 Setting up collections & indexing...");

  await createHybridCollection(TEST_HYBRID_COLLECTION);
  await createHybridCollection(TEST_ALT_COLLECTION);
  await createHybridCollection(TEST_CAT_COLLECTION);

  // Index tools
  const toolDocs = TOOLS.map(buildToolDocument);
  const toolVecs = await embed(toolDocs);

  const toolPoints = TOOLS.map((tool, i) => {
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

  await qdrant.upsert(TEST_HYBRID_COLLECTION, {
    wait: true,
    points: toolPoints,
  });

  // Also index into alternatives collection
  await qdrant.upsert(TEST_ALT_COLLECTION, {
    wait: true,
    points: toolPoints.map((p, i) => ({
      ...p,
      payload: {
        id: TOOLS[i].id,
        slug: TOOLS[i].slug,
        name: TOOLS[i].name,
        description: TOOLS[i].description,
        relatedToolIds: [],
      },
    })),
  });

  // Index categories
  const catDocs = CATEGORIES.map((c) => `${c.name}\n\n${c.description}`);
  const catVecs = await embed(catDocs);

  await qdrant.upsert(TEST_CAT_COLLECTION, {
    wait: true,
    points: CATEGORIES.map((cat, i) => {
      const sparse = sparseEmbed(catDocs[i]);
      return {
        id: toUUID(cat.id),
        vector: {
          dense: catVecs[i],
          sparse: { indices: sparse.indices, values: sparse.values },
        },
        payload: {
          id: cat.id,
          slug: cat.slug,
          name: cat.name,
          description: cat.description,
        },
      };
    }),
  });

  console.log(
    `  ✅ Indexed ${TOOLS.length} tools + ${CATEGORIES.length} categories\n`
  );

  // ════════════════════════════════════════════════════════════════════════
  // TEST 1: KEYWORD SEARCH (BM25 Sparse Vectors)
  // ════════════════════════════════════════════════════════════════════════
  console.log("═".repeat(60));
  console.log("1️⃣  KEYWORD SEARCH (BM25 Sparse Vectors)");
  console.log("═".repeat(60));

  const keywordTests = [
    { query: "project management", expect: ["linear", "jira"] },
    { query: "design tool", expect: ["figma", "canva"] },
    { query: "note-taking markdown", expect: ["obsidian", "notion"] },
    { query: "code editor extensions", expect: ["vscode"] },
    { query: "agile scrum issues", expect: ["jira", "linear"] },
  ];

  for (const test of keywordTests) {
    const sparse = sparseEmbed(test.query);
    const results = await qdrant.query(TEST_HYBRID_COLLECTION, {
      query: { indices: sparse.indices, values: sparse.values },
      using: "sparse",
      limit: 3,
      with_payload: true,
    });

    const slugs = results.points.map(
      (p) => (p.payload as { slug: string }).slug
    );
    const hasExpected = test.expect.some((e) => slugs.includes(e));

    console.log(`\n  Query: "${test.query}"`);
    for (const pt of results.points) {
      const payload = pt.payload as { slug: string; name: string };
      console.log(
        `    score=${pt.score.toFixed(4)}  ${payload.name} (${payload.slug})`
      );
    }
    assert(
      `Expected [${test.expect.join("|")}] in top results`,
      hasExpected,
      `got [${slugs.join(", ")}]`
    );
  }

  // ════════════════════════════════════════════════════════════════════════
  // TEST 2: SEMANTIC SEARCH (Dense Embeddings)
  // ════════════════════════════════════════════════════════════════════════
  console.log("\n" + "═".repeat(60));
  console.log("2️⃣  SEMANTIC SEARCH (Dense Embeddings)");
  console.log("═".repeat(60));

  const semanticTests = [
    {
      query: "I need a tool to take notes and organize my knowledge",
      expect: ["notion", "obsidian"],
    },
    {
      query: "software to create beautiful interfaces and mockups",
      expect: ["figma", "canva"],
    },
    {
      query: "track bugs and plan sprints for my development team",
      expect: ["jira", "linear"],
    },
    {
      query: "team messaging and real-time chat application",
      expect: ["slack"],
    },
    {
      query: "write and debug code with intelligent autocomplete",
      expect: ["vscode"],
    },
  ];

  for (const test of semanticTests) {
    const queryVec = await embedOne(test.query);
    const results = await qdrant.query(TEST_HYBRID_COLLECTION, {
      query: queryVec,
      using: "dense",
      limit: 3,
      with_payload: true,
    });

    const slugs = results.points.map(
      (p) => (p.payload as { slug: string }).slug
    );
    const hasExpected = test.expect.some((e) => slugs.includes(e));

    console.log(`\n  Query: "${test.query}"`);
    for (const pt of results.points) {
      const payload = pt.payload as { slug: string; name: string };
      console.log(
        `    score=${pt.score.toFixed(4)}  ${payload.name} (${payload.slug})`
      );
    }
    assert(
      `Expected [${test.expect.join("|")}] in top results`,
      hasExpected,
      `got [${slugs.join(", ")}]`
    );
  }

  // ════════════════════════════════════════════════════════════════════════
  // TEST 3: HYBRID SEARCH (Dense + Sparse with RRF Fusion)
  // ════════════════════════════════════════════════════════════════════════
  console.log("\n" + "═".repeat(60));
  console.log("3️⃣  HYBRID SEARCH (RRF Fusion: Dense + Sparse)");
  console.log("═".repeat(60));

  const hybridTests = [
    {
      query: "project management agile",
      expect: ["linear", "jira"],
    },
    {
      query: "UI design prototyping tool",
      expect: ["figma"],
    },
    {
      query: "productivity note taking workspace",
      expect: ["notion", "obsidian"],
    },
  ];

  for (const test of hybridTests) {
    const denseQuery = await embedOne(test.query);
    const sparseQuery = sparseEmbed(test.query);

    const results = await qdrant.query(TEST_HYBRID_COLLECTION, {
      prefetch: [
        { query: denseQuery, using: "dense", limit: 10 },
        {
          query: {
            indices: sparseQuery.indices,
            values: sparseQuery.values,
          },
          using: "sparse",
          limit: 10,
        },
      ],
      query: { fusion: "rrf" },
      limit: 5,
      with_payload: true,
    });

    const slugs = results.points.map(
      (p) => (p.payload as { slug: string }).slug
    );
    const hasExpected = test.expect.some((e) => slugs.includes(e));

    console.log(`\n  Query: "${test.query}"`);
    for (const pt of results.points) {
      const payload = pt.payload as { slug: string; name: string };
      console.log(
        `    score=${pt.score.toFixed(4)}  ${payload.name} (${payload.slug})`
      );
    }
    assert(
      `Expected [${test.expect.join("|")}] in top results`,
      hasExpected,
      `got [${slugs.join(", ")}]`
    );
  }

  // ════════════════════════════════════════════════════════════════════════
  // TEST 4: SIMILAR TOOL SUGGESTIONS (Qdrant Recommend API)
  // ════════════════════════════════════════════════════════════════════════
  console.log("\n" + "═".repeat(60));
  console.log("4️⃣  SIMILAR TOOL SUGGESTIONS (Recommend API)");
  console.log("═".repeat(60));

  const recommendTests = [
    {
      source: "notion",
      expectSimilar: ["obsidian"],
      expectNotSimilar: ["vscode"],
    },
    {
      source: "figma",
      expectSimilar: ["canva"],
      expectNotSimilar: ["slack"],
    },
    {
      source: "linear",
      expectSimilar: ["jira"],
      expectNotSimilar: ["obsidian"],
    },
    {
      source: "vscode",
      expectSimilar: ["linear"], // both dev-tools
      expectNotSimilar: ["canva"],
    },
  ];

  for (const test of recommendTests) {
    const sourceTool = TOOLS.find((t) => t.slug === test.source)!;

    const results = await qdrant.query(TEST_HYBRID_COLLECTION, {
      query: {
        recommend: {
          positive: [toUUID(sourceTool.id)],
          negative: [],
        },
      },
      using: "dense",
      limit: 5,
      with_payload: true,
    });

    // Exclude the source tool itself
    const recommendations = results.points.filter(
      (p) => (p.payload as { id: string }).id !== sourceTool.id
    );
    const recSlugs = recommendations.map(
      (p) => (p.payload as { slug: string }).slug
    );

    console.log(`\n  Source: ${sourceTool.name} (${sourceTool.slug})`);
    for (const pt of recommendations.slice(0, 4)) {
      const payload = pt.payload as { slug: string; name: string };
      console.log(
        `    score=${pt.score.toFixed(4)}  ${payload.name} (${payload.slug})`
      );
    }

    const hasSimilar = test.expectSimilar.some((e) => recSlugs.includes(e));
    assert(
      `${sourceTool.name} → similar to [${test.expectSimilar.join(", ")}]`,
      hasSimilar,
      `got [${recSlugs.slice(0, 3).join(", ")}]`
    );

    // Check that unrelated tools are ranked lower
    if (test.expectNotSimilar.length > 0 && recommendations.length >= 2) {
      const firstRecSlug = recSlugs[0];
      const notSimilarInTop1 = !test.expectNotSimilar.includes(firstRecSlug);
      assert(
        `${sourceTool.name} → [${test.expectNotSimilar.join(", ")}] NOT #1 result`,
        notSimilarInTop1
      );
    }
  }

  // ════════════════════════════════════════════════════════════════════════
  // TEST 5: CATEGORY SEARCH (Hybrid)
  // ════════════════════════════════════════════════════════════════════════
  console.log("\n" + "═".repeat(60));
  console.log("5️⃣  CATEGORY SEARCH (Hybrid)");
  console.log("═".repeat(60));

  const catTests = [
    { query: "organize tasks and get things done", expect: ["productivity"] },
    { query: "create user interfaces", expect: ["design"] },
    { query: "coding and programming tools", expect: ["developer-tools"] },
    { query: "track issues and plan roadmaps", expect: ["project-management"] },
  ];

  for (const test of catTests) {
    const denseQuery = await embedOne(test.query);
    const sparseQuery = sparseEmbed(test.query);

    const results = await qdrant.query(TEST_CAT_COLLECTION, {
      prefetch: [
        { query: denseQuery, using: "dense", limit: 8 },
        {
          query: {
            indices: sparseQuery.indices,
            values: sparseQuery.values,
          },
          using: "sparse",
          limit: 8,
        },
      ],
      query: { fusion: "rrf" },
      limit: 3,
      with_payload: true,
    });

    const slugs = results.points.map(
      (p) => (p.payload as { slug: string }).slug
    );
    const hasExpected = test.expect.some((e) => slugs.includes(e));

    console.log(`\n  Query: "${test.query}"`);
    for (const pt of results.points) {
      const payload = pt.payload as { slug: string; name: string };
      console.log(
        `    score=${pt.score.toFixed(4)}  ${payload.name} (${payload.slug})`
      );
    }
    assert(
      `Expected category [${test.expect.join("|")}] in results`,
      hasExpected,
      `got [${slugs.join(", ")}]`
    );
  }

  // ════════════════════════════════════════════════════════════════════════
  // TEST 6: EDGE CASES
  // ════════════════════════════════════════════════════════════════════════
  console.log("\n" + "═".repeat(60));
  console.log("6️⃣  EDGE CASES");
  console.log("═".repeat(60));

  // Empty-ish query
  console.log("\n  Query: very short string");
  const shortVec = await embedOne("a");
  const shortResults = await qdrant.query(TEST_HYBRID_COLLECTION, {
    query: shortVec,
    using: "dense",
    limit: 3,
    with_payload: true,
  });
  assert(
    "Short query returns results without error",
    shortResults.points.length > 0
  );

  // Completely unrelated query
  console.log("\n  Query: completely unrelated");
  const unrelatedVec = await embedOne(
    "quantum physics equations for black hole thermodynamics"
  );
  const unrelatedResults = await qdrant.query(TEST_HYBRID_COLLECTION, {
    query: unrelatedVec,
    using: "dense",
    limit: 3,
    with_payload: true,
  });

  const topUnrelatedScore = unrelatedResults.points[0]?.score ?? 0;
  console.log(`    Top score: ${topUnrelatedScore.toFixed(4)}`);
  assert(
    "Unrelated query has lower similarity scores",
    topUnrelatedScore < 0.5,
    `score=${topUnrelatedScore.toFixed(4)}`
  );

  // Filtered search by category
  console.log("\n  Filtered search: category=design");
  const designVec = await embedOne("best creative tools");

  // Create payload index first
  await qdrant.createPayloadIndex(TEST_HYBRID_COLLECTION, {
    field_name: "categories",
    field_schema: "keyword",
  });

  const filteredResults = await qdrant.query(TEST_HYBRID_COLLECTION, {
    query: designVec,
    using: "dense",
    limit: 5,
    with_payload: true,
    filter: { must: [{ key: "categories", match: { any: ["design"] } }] },
  });

  const filteredSlugs = filteredResults.points.map(
    (p) => (p.payload as { slug: string }).slug
  );
  console.log(`    Results: [${filteredSlugs.join(", ")}]`);
  const allDesign = filteredResults.points.every((p) =>
    ((p.payload as { categories: string[] }).categories ?? []).includes(
      "design"
    )
  );
  assert("All filtered results belong to 'design' category", allDesign);

  // ── Cleanup ────────────────────────────────────────────────────────────
  console.log("\n🧹 Cleanup");
  await qdrant.deleteCollection(TEST_HYBRID_COLLECTION);
  await qdrant.deleteCollection(TEST_ALT_COLLECTION);
  await qdrant.deleteCollection(TEST_CAT_COLLECTION);
  assert("Test collections deleted", true);

  // ── Summary ────────────────────────────────────────────────────────────
  console.log("\n" + "═".repeat(60));
  console.log(`📊 Results: ${passed} passed, ${failed} failed`);
  console.log("═".repeat(60));

  if (failed > 0) {
    process.exit(1);
  }
  console.log(
    "\n✅ All search features working with local Qdrant + Infinity (384d)!"
  );
};

run().catch((err) => {
  console.error("💥 Fatal error:", err);
  process.exit(1);
});
