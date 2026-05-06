import * as z from "zod";

export const searchParamsSchema = z.object({
  page: z.coerce.number().default(1),
  per_page: z.coerce.number().default(50),
  sort: z.string().optional(),
  name: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  operator: z.enum(["and", "or"]).optional(),
});

export const getToolsSchema = searchParamsSchema;

export type GetToolsSchema = z.infer<typeof getToolsSchema>;

export const socialSchema = z.object({
  name: z
    .string()
    .min(1, "Name is required")
    .max(100, "Name must be less than 100 characters"),
  url: z
    .string()
    .url("Must be a valid URL")
    .max(500, "URL must be less than 500 characters"),
});

export const toolSchema = z.object({
  name: z
    .string()
    .min(1, "Name is required")
    .max(100, "Name must be less than 100 characters"),
  slug: z.string().max(150, "Slug must be less than 150 characters").optional(),
  tagline: z
    .string()
    .max(200, "Tagline must be less than 200 characters")
    .optional(),
  description: z
    .string()
    .max(500, "Description must be less than 500 characters")
    .optional(),
  content: z
    .string()
    .max(50_000, "Content must be less than 50,000 characters")
    .optional(),
  websiteUrl: z
    .string()
    .url("Invalid URL")
    .min(1, "Website URL is required")
    .max(500, "URL must be less than 500 characters"),
  affiliateUrl: z
    .string()
    .url("Invalid URL")
    .max(500, "URL must be less than 500 characters")
    .optional(),
  faviconUrl: z
    .string()
    .url("Invalid URL")
    .max(500, "URL must be less than 500 characters")
    .optional(),
  screenshotUrl: z
    .string()
    .url("Invalid URL")
    .max(500, "URL must be less than 500 characters")
    .optional(),
  socials: z.array(socialSchema).optional(),
  isFeatured: z.boolean().default(false),
  pricing: z
    .string()
    .max(100, "Pricing must be less than 100 characters")
    .optional(),
  xHandle: z
    .string()
    .max(50, "Handle must be less than 50 characters")
    .optional(),
  submitterName: z
    .string()
    .max(100, "Name must be less than 100 characters")
    .optional(),
  submitterEmail: z
    .string()
    .email("Invalid email")
    .max(255, "Email must be less than 255 characters")
    .optional(),
  nameVi: z
    .string()
    .max(100, "Name Vi must be less than 100 characters")
    .optional(),
  taglineVi: z
    .string()
    .max(200, "Tagline Vi must be less than 200 characters")
    .optional(),
  descriptionVi: z
    .string()
    .max(500, "Description Vi must be less than 500 characters")
    .optional(),
  contentVi: z
    .string()
    .max(50_000, "Content Vi must be less than 50,000 characters")
    .optional(),
  pricingVi: z
    .string()
    .max(100, "Pricing Vi must be less than 100 characters")
    .optional(),
  publishedAt: z.date().optional(),
  categories: z.array(z.string()).optional(),
  collections: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
});

export type ToolSchema = z.infer<typeof toolSchema>;
