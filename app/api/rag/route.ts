import { NextResponse } from "next/server";
import { z } from "zod";
import {
  answerToolQuestion,
  answerToolQuestionAdvanced,
  retrieveToolContext,
  retrieveToolContextWithRouting,
} from "~/lib/rag";

const ragQuerySchema = z.object({
  question: z.string().min(1).max(500),
  limit: z.number().int().min(1).max(20).optional(),
  category: z.string().optional(),
  temperature: z.number().min(0).max(2).optional(),
  /** Use advanced RAG with query routing and hybrid search */
  advanced: z.boolean().optional(),
});

const contextQuerySchema = z.object({
  query: z.string().min(1).max(500),
  limit: z.number().int().min(1).max(20).optional(),
  category: z.string().optional(),
  /** Use advanced retrieval with query routing */
  advanced: z.boolean().optional(),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { question, limit, category, temperature, advanced } =
      ragQuerySchema.parse(body);

    // Use advanced RAG if requested
    const result = advanced
      ? await answerToolQuestionAdvanced(question, {
          limit,
          category,
          temperature,
        })
      : await answerToolQuestion(question, { limit, category, temperature });

    const { cache, ...rest } = result;
    const responseBody = cache ? { ...rest, cache, cached: true } : rest;

    return NextResponse.json(responseBody);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request", details: error.issues },
        { status: 400 }
      );
    }

    console.error("RAG API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("query") || "";
    const limit = searchParams.get("limit");
    const category = searchParams.get("category");
    const advanced = searchParams.get("advanced");

    const parsed = contextQuerySchema.parse({
      query,
      limit: limit ? Number.parseInt(limit, 10) : undefined,
      category: category || undefined,
      advanced: advanced === "true",
    });

    // Use advanced retrieval if requested
    if (parsed.advanced) {
      const result = await retrieveToolContextWithRouting(parsed.query, {
        limit: parsed.limit,
        category: parsed.category,
      });
      return NextResponse.json({ context: result.context });
    }

    const context = await retrieveToolContext(parsed.query, {
      limit: parsed.limit,
      category: parsed.category,
    });

    return NextResponse.json({ context });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request", details: error.issues },
        { status: 400 }
      );
    }

    console.error("RAG context API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
