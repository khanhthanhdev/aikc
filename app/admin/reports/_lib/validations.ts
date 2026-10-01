import * as z from "zod";

export const searchParamsSchema = z.object({
  from: z.string().optional(),
  message: z.string().optional(),
  operator: z.enum(["and", "or"]).optional(),
  page: z.coerce.number().default(1),
  per_page: z.coerce.number().default(50),
  sort: z.string().optional(),
  status: z.string().optional(),
  to: z.string().optional(),
  type: z.string().optional(),
});

export const getReportsSchema = searchParamsSchema;

export type GetReportsSchema = z.infer<typeof getReportsSchema>;

export const reportIdsSchema = z.object({
  ids: z.array(z.string().min(1)).min(1),
});

export const resolveReportsSchema = reportIdsSchema.extend({
  resolved: z.boolean(),
});
