/**
 * Test script to verify the local Infinity embedding server.
 *
 * Usage:
 *   SKIP_ENV_VALIDATION=true bun run scripts/test-infinity-embedding.ts
 */

const INFINITY_URL =
  process.env.LOCAL_INFINITY_EMBEDDING_URL ?? "http://localhost:7997";
const MODEL =
  process.env.LOCAL_INFINITY_EMBEDDING_MODEL ??
  "sentence-transformers/all-MiniLM-L6-v2";

const getEmbeddingUrl = (baseUrl: string): string =>
  `${baseUrl.replace(/\/$/, "")}/embeddings`;

const getHealthUrl = (baseUrl: string): string =>
  `${baseUrl.replace(/\/v1\/?$/, "").replace(/\/$/, "")}/health`;

const testTexts = [
  "What is the best project management tool?",
  "React framework for building web applications",
  "Open source alternative to Notion",
];

const run = async () => {
  console.log(`Testing Infinity embedding server at: ${INFINITY_URL}`);
  console.log(`Model: ${MODEL}\n`);

  // 1. Health check
  try {
    const healthRes = await fetch(getHealthUrl(INFINITY_URL));
    console.log(`Health check: ${healthRes.status} ${healthRes.statusText}`);
  } catch (error) {
    console.error("❌ Health check failed — is Infinity running on port 7997?");
    console.error(error);
    process.exit(1);
  }

  // 2. Single embedding
  console.log("\n--- Single Embedding ---");
  const singleRes = await fetch(getEmbeddingUrl(INFINITY_URL), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      input: testTexts[0],
    }),
  });

  if (!singleRes.ok) {
    console.error(`❌ Embedding request failed: ${singleRes.status}`);
    console.error(await singleRes.text());
    process.exit(1);
  }

  const singleData = await singleRes.json();
  const embedding = singleData.data[0].embedding;
  console.log(`✅ Dimensions: ${embedding.length}`);
  console.log(
    `   First 5 values: [${embedding
      .slice(0, 5)
      .map((v: number) => v.toFixed(6))
      .join(", ")}]`
  );
  console.log(`   Model: ${singleData.model}`);

  // 3. Batch embeddings
  console.log("\n--- Batch Embeddings ---");
  const batchRes = await fetch(getEmbeddingUrl(INFINITY_URL), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      input: testTexts,
    }),
  });

  if (!batchRes.ok) {
    console.error(`❌ Batch request failed: ${batchRes.status}`);
    console.error(await batchRes.text());
    process.exit(1);
  }

  const batchData = await batchRes.json();
  console.log(`✅ Generated ${batchData.data.length} embeddings`);

  for (const item of batchData.data) {
    console.log(`   [${item.index}] dims=${item.embedding.length}`);
  }

  // 4. Cosine similarity test
  console.log("\n--- Similarity Test ---");
  const cosine = (a: number[], b: number[]) => {
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

  const embeddings = batchData.data.map(
    (d: { embedding: number[] }) => d.embedding
  );
  for (let i = 0; i < testTexts.length; i++) {
    for (let j = i + 1; j < testTexts.length; j++) {
      const sim = cosine(embeddings[i], embeddings[j]);
      console.log(
        `   "${testTexts[i].slice(0, 30)}..." ↔ "${testTexts[j].slice(0, 30)}..." = ${sim.toFixed(4)}`
      );
    }
  }

  console.log("\n✅ All tests passed! Infinity is ready for use.");
  console.log(`   Local embedding dimensions: ${embedding.length}`);
};

run().catch((error: unknown) => {
  console.error("❌ Local Infinity test failed");
  console.error(error);
  process.exit(1);
});
