import {
  generateInfinityEmbedding,
  INFINITY_EMBEDDING_DIMENSIONS,
  INFINITY_EMBEDDING_MODEL,
  type InfinityEmbeddingOptions,
} from "~/services/infinity";

export const EMBEDDING_MODEL = INFINITY_EMBEDDING_MODEL;
export const EMBEDDING_DIMENSIONS = INFINITY_EMBEDDING_DIMENSIONS;

export const generateEmbedding = async (
  value: string,
  options: InfinityEmbeddingOptions = {}
): Promise<number[]> => {
  const outputDimensionality =
    options.outputDimensionality ?? EMBEDDING_DIMENSIONS;

  return generateInfinityEmbedding(value, { outputDimensionality });
};
