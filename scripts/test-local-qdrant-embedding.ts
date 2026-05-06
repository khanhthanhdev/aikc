/**
 * Local integration test for Qdrant + Infinity embedding (384 dimensions).
 *
 * Prerequisites:
 *   - Qdrant running on http://localhost:6333
 *   - Infinity embedding server running on http://localhost:7997
 *
 * Usage:
 *   SKIP_ENV_VALIDATION=true bun run scripts/test-local-qdrant-embedding.ts
 */

import { QdrantClient } from "@qdrant/js-client-rest";
import { randomUUIDv7 } from "bun";

const QDRANT_URL = process.env.LOCAL_QDRANT_URL ?? "http://localhost:6333";
const QDRANT_API_KEY = process.env.LOCAL_QDRANT_API_KEY;
const INFINITY_URL =
  process.env.LOCAL_INFINITY_EMBEDDING_URL ?? "http://localhost:7997";
const MODEL =
  process.env.LOCAL_INFINITY_EMBEDDING_MODEL ??
  "sentence-transformers/all-MiniLM-L6-v2";
const EXPECTED_DIMS = Number(
  process.env.LOCAL_INFINITY_EMBEDDING_DIMENSIONS ?? "384"
);
const TEST_COLLECTION =
  process.env.LOCAL_QDRANT_TEST_COLLECTION ?? `test_local_${EXPECTED_DIMS}`;

const getEmbeddingUrl = (baseUrl: string): string =>
  `${baseUrl.replace(/\/$/, "")}/embeddings`;

const getInfinityHealthUrl = (baseUrl: string): string =>
  `${baseUrl.replace(/\/v1\/?$/, "").replace(/\/$/, "")}/health`;

const qdrantHeaders = QDRANT_API_KEY
  ? { "api-key": QDRANT_API_KEY }
  : undefined;

const qdrant = new QdrantClient({
  url: QDRANT_URL,
  checkCompatibility: false,
  ...(QDRANT_API_KEY ? { apiKey: QDRANT_API_KEY } : {}),
});

// ── Helpers ──────────────────────────────────────────────────────────────────

const embed = async (texts: string[]): Promise<number[][]> => {
  const res = await fetch(getEmbeddingUrl(INFINITY_URL), {
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

const cosine = (a: number[], b: number[]): number => {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
};

let passed = 0;
let failed = 0;

const assert = (label: string, condition: boolean, detail?: string) => {
  if (condition) {
    passed++;
    console.log(`  ✅ ${label}`);
  } else {
    failed++;
    console.log(`  ❌ ${label}${detail ? ` — ${detail}` : ""}`);
  }
};

// ── Tests ────────────────────────────────────────────────────────────────────

const run = async () => {
  console.log("🧪 Local Qdrant + Embedding Integration Test");
  console.log(`   Qdrant:    ${QDRANT_URL}`);
  console.log(`   Infinity:  ${INFINITY_URL}`);
  console.log(`   Model:     ${MODEL}`);
  console.log(`   Expected dims: ${EXPECTED_DIMS}`);
  console.log("");

  // ── 1. Health checks ────────────────────────────────────────────────────
  console.log("1️⃣  Health checks");

  const qdrantHealth = await fetch(`${QDRANT_URL}/healthz`, {
    headers: qdrantHeaders,
  });
  assert("Qdrant healthy", qdrantHealth.ok);

  const infinityHealth = await fetch(getInfinityHealthUrl(INFINITY_URL));
  assert("Infinity healthy", infinityHealth.ok);

  // ── 2. Embedding dimension check ────────────────────────────────────────
  console.log("\n2️⃣  Embedding dimension check");

  const [singleVec] = await embed(["Hello world"]);
  assert(
    `Dimension = ${EXPECTED_DIMS}`,
    singleVec.length === EXPECTED_DIMS,
    `got ${singleVec.length}`
  );

  // ── 3. Batch embeddings & similarity ────────────────────────────────────
  console.log("\n3️⃣  Batch embeddings & similarity");

  const texts = [
    "React framework for building user interfaces",
    "Vue.js progressive JavaScript framework",
    "How to cook pasta carbonara",
  ];

  const vecs = await embed(texts);
  assert(
    `Batch returned ${texts.length} vectors`,
    vecs.length === texts.length
  );

  const simReactVue = cosine(vecs[0], vecs[1]);
  const simReactPasta = cosine(vecs[0], vecs[2]);
  console.log(`   React↔Vue similarity:   ${simReactVue.toFixed(4)}`);
  console.log(`   React↔Pasta similarity: ${simReactPasta.toFixed(4)}`);
  assert(
    "Related texts more similar than unrelated",
    simReactVue > simReactPasta,
    `${simReactVue.toFixed(4)} vs ${simReactPasta.toFixed(4)}`
  );

  // ── 4. Qdrant collection lifecycle ──────────────────────────────────────
  console.log("\n4️⃣  Qdrant collection lifecycle");

  // Cleanup if exists from previous run
  const existsBefore = await qdrant.collectionExists(TEST_COLLECTION);
  if (typeof existsBefore === "boolean" ? existsBefore : existsBefore?.exists) {
    await qdrant.deleteCollection(TEST_COLLECTION);
  }

  // Create with dense + sparse (hybrid)
  await qdrant.createCollection(TEST_COLLECTION, {
    vectors: {
      dense: { size: EXPECTED_DIMS, distance: "Cosine" },
    },
    sparse_vectors: {
      sparse: { index: { on_disk: false } },
    },
  });
  assert("Collection created", true);

  const info = await qdrant.getCollection(TEST_COLLECTION);
  assert("Collection status green", info.status === "green");

  // ── 5. Upsert vectors ──────────────────────────────────────────────────
  console.log("\n5️⃣  Upsert vectors");

  const docs = [
    {
      id: randomUUIDv7(),
      text: "Notion is a productivity tool for note-taking",
    },
    { id: randomUUIDv7(), text: "Figma is a design tool for UI/UX" },
    { id: randomUUIDv7(), text: "VS Code is a code editor by Microsoft" },
    { id: randomUUIDv7(), text: "Slack is a team communication platform" },
    {
      id: randomUUIDv7(),
      text: "Linear is a project management tool for software teams",
    },
  ];

  const docVecs = await embed(docs.map((d) => d.text));

  await qdrant.upsert(TEST_COLLECTION, {
    wait: true,
    points: docs.map((doc, i) => ({
      id: doc.id,
      vector: { dense: docVecs[i] },
      payload: { text: doc.text },
    })),
  });

  const afterUpsert = await qdrant.getCollection(TEST_COLLECTION);
  assert(
    `Upserted ${docs.length} points`,
    afterUpsert.points_count === docs.length,
    `count=${afterUpsert.points_count}`
  );

  // ── 6. Dense vector search ─────────────────────────────────────────────
  console.log("\n6️⃣  Dense vector search");

  const [queryVec] = await embed(["project management software"]);
  const searchResults = await qdrant.query(TEST_COLLECTION, {
    query: queryVec,
    using: "dense",
    limit: 3,
    with_payload: true,
  });

  assert("Search returned results", searchResults.points.length > 0);
  console.log("   Top results:");
  for (const pt of searchResults.points) {
    const payload = pt.payload as { text: string };
    console.log(`     score=${pt.score.toFixed(4)}  "${payload.text}"`);
  }

  const topText = (searchResults.points[0].payload as { text: string }).text;
  assert(
    "Top result is project-management related",
    topText.includes("Linear") || topText.includes("Notion")
  );

  // ── 7. Filtered search ─────────────────────────────────────────────────
  console.log("\n7️⃣  Filtered search");

  // Add payload index for filtering
  await qdrant.createPayloadIndex(TEST_COLLECTION, {
    field_name: "text",
    field_schema: "text",
  });

  const [designQuery] = await embed(["design tools"]);
  const filteredResults = await qdrant.query(TEST_COLLECTION, {
    query: designQuery,
    using: "dense",
    limit: 3,
    with_payload: true,
    filter: {
      must: [{ key: "text", match: { text: "design" } }],
    },
  });

  assert("Filtered search returned results", filteredResults.points.length > 0);
  if (filteredResults.points.length > 0) {
    const filteredText = (filteredResults.points[0].payload as { text: string })
      .text;
    assert(
      'Filtered result contains "design"',
      filteredText.toLowerCase().includes("design")
    );
  }

  // ── 8. Point retrieval ─────────────────────────────────────────────────
  console.log("\n8️⃣  Point retrieval");

  const retrieved = await qdrant.retrieve(TEST_COLLECTION, {
    ids: [docs[0].id],
    with_payload: true,
    with_vector: true,
  });

  assert("Retrieved point by ID", retrieved.length === 1);
  const retrievedVec = (retrieved[0].vector as { dense: number[] }).dense;
  assert(
    "Retrieved vector has correct dimensions",
    retrievedVec.length === EXPECTED_DIMS
  );

  // ── 9. Delete & verify ─────────────────────────────────────────────────
  console.log("\n9️⃣  Delete & verify");

  await qdrant.delete(TEST_COLLECTION, {
    wait: true,
    points: [docs[0].id],
  });

  const afterDelete = await qdrant.getCollection(TEST_COLLECTION);
  assert(
    "Point deleted",
    afterDelete.points_count === docs.length - 1,
    `count=${afterDelete.points_count}`
  );

  // ── 10. Cleanup ────────────────────────────────────────────────────────
  console.log("\n🧹 Cleanup");
  await qdrant.deleteCollection(TEST_COLLECTION);
  assert("Test collection deleted", true);

  // ── Summary ────────────────────────────────────────────────────────────
  console.log(`\n${"═".repeat(50)}`);
  console.log(`📊 Results: ${passed} passed, ${failed} failed`);
  console.log("═".repeat(50));

  if (failed > 0) {
    process.exit(1);
  }

  console.log("\n✅ All tests passed! Qdrant + Infinity (384d) is working.");
};

run().catch((err) => {
  console.error("💥 Fatal error:", err);
  process.exit(1);
});
