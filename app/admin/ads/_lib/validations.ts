import * as z from "zod";

export const searchParamsSchema = z.object({
  page: z.coerce.number().default(1),
  per_page: z.coerce.number().default(50),
  sort: z.string().optional(),
  name: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
});

export const getAdsSchema = searchParamsSchema;

export type GetAdsSchema = z.infer<typeof getAdsSchema>;

export const adSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email").min(1, "Email is required"),
  description: z.string().optional(),
  websiteUrl: z.string().url("Invalid URL").min(1, "Website URL is required"),
  buttonLabel: z.string().optional(),
  faviconUrl: z.string().url("Invalid URL").optional().or(z.literal("")),
  type: z
    .enum(["Banner", "Similars", "Tools", "ToolPage", "BlogPost", "All"])
    .default("All"),
  stepOrder: z.coerce.number().default(0),
  listInjectionIndex: z.coerce.number().default(2),
  startsAt: z.date(),
  endsAt: z.date(),
});

export type AdSchema = z.infer<typeof adSchema>;
