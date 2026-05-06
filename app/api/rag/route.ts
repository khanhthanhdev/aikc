import { NextResponse } from "next/server";
import { z } from "zod";
import {
  isSameOrigin,
  rateLimitByIpMulti,
  rateLimitResponse,
} from "~/lib/rate-limit";
import {
  answerToolQuestion,
  answerToolQuestionAdvanced,
  retrieveToolContext,
  retrieveToolContextWithRouting,
} from "~/lib/rag";

const ragQuerySchema = z.object({
  question: z.string().min(1).max(500),
  limit: z.number().int().min(1).max(20).optional(),
  category: z.string().max(100).optional(),
  temperature: z.number().min(0).max(2).optional(),
  /** Use advanced RAG with query routing and hybrid search */
  advanced: z.boolean().optional(),
});

const contextQuerySchema = z.object({
  query: z.string().min(1).max(500),
  limit: z.number().int().min(1).max(20).optional(),
  category: z.string().max(100).optional(),
  /** Use advanced retrieval with query routing */
  advanced: z.boolean().optional(),
});

const RAG_LIMITS = [
  { scope: "rag:minute", limit: 10, windowSeconds: 60 },
  { scope: "rag:day", limit: 100, windowSeconds: 24 * 60 * 60 },
] as const;

function originDenied() {
  return NextResponse.json(
    { error: "Cross-origin requests are not allowed" },
    { status: 403 }
  );
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return originDenied();
  }

  const limit = rateLimitByIpMulti(request, [...RAG_LIMITS]);
  if (!limit.success) {
    return rateLimitResponse(
      limit,
      limit.scope === "rag:day"
        ? "Daily limit reached. Please try again tomorrow."
        : "Too many requests. Please slow down and try again in a minute."
    );
  }

  try {
    const body = await request.json();
    const { question, limit: take, category, temperature, advanced } =
      ragQuerySchema.parse(body);

    const result = advanced
      ? await answerToolQuestionAdvanced(question, {
          limit: take,
          category,
          temperature,
        })
      : await answerToolQuestion(question, {
          limit: take,
          category,
          temperature,
        });

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

    console.error("RAG API error");
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  if (!isSameOrigin(request)) {
    return originDenied();
  }

  const limit = rateLimitByIpMulti(request, [...RAG_LIMITS]);
  if (!limit.success) {
    return rateLimitResponse(limit);
  }

  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("query") || "";
    const take = searchParams.get("limit");
    const category = searchParams.get("category");
    const advanced = searchParams.get("advanced");

    const parsed = contextQuerySchema.parse({
      query,
      limit: take ? Number.parseInt(take, 10) : undefined,
      category: category || undefined,
      advanced: advanced === "true",
    });

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

    console.error("RAG context API error");
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
