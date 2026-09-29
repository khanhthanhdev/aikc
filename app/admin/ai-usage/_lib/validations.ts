import * as z from "zod";

export const searchParamsSchema = z.object({
  endpoint: z.string().optional(),
  from: z.string().optional(),
  operator: z.enum(["and", "or"]).optional(),
  page: z.coerce.number().default(1),
  per_page: z.coerce.number().default(50),
  question: z.string().optional(),
  sort: z.string().optional(),
  status: z.string().optional(),
  to: z.string().optional(),
});

export const getAiQueriesSchema = searchParamsSchema;

export type GetAiQueriesSchema = z.infer<typeof getAiQueriesSchema>;

export const aiQueryIdSchema = z.object({ id: z.string().min(1) });
