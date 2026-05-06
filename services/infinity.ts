import { env } from "~/env";

const INFINITY_BASE_URL = env.INFINITY_EMBEDDING_URL;
const INFINITY_API_KEY = "no-key-needed";

export const INFINITY_EMBEDDING_MODEL = env.INFINITY_EMBEDDING_MODEL;
export const INFINITY_EMBEDDING_DIMENSIONS = Number(
  env.INFINITY_EMBEDDING_DIMENSIONS
);

export interface InfinityEmbeddingOptions {
  outputDimensionality?: number;
}

/**
 * Generate embedding using Infinity's native /embeddings endpoint.
 * Infinity v2 uses /embeddings (not /v1/embeddings like OpenAI).
 */
export const generateInfinityEmbedding = async (
  value: string,
  options: InfinityEmbeddingOptions = {}
): Promise<number[]> => {
  const outputDimensionality = Number(
    options.outputDimensionality ?? INFINITY_EMBEDDING_DIMENSIONS
  );

  const response = await fetch(`${INFINITY_BASE_URL}/embeddings`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${INFINITY_API_KEY}`,
    },
    body: JSON.stringify({
      input: [value],
      model: INFINITY_EMBEDDING_MODEL,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Infinity API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  const embedding = data.data?.[0]?.embedding;

  if (!embedding) {
    throw new Error("No embedding returned from Infinity");
  }

  if (embedding.length !== outputDimensionality) {
    throw new Error(
      `Embedding dimension mismatch: expected ${outputDimensionality}, got ${embedding.length}.`
    );
  }

  return embedding;
};
