import { z } from "zod";

export const SUBMIT_LIMITS = {
  name: 100,
  websiteUrl: 500,
  submitterName: 100,
  submitterEmail: 255,
} as const;

const SAFE_TEXT_PATTERN = /^[^<>"'&]*$/;

const submitToolFieldsSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Name is required")
    .max(
      SUBMIT_LIMITS.name,
      `Name must be less than ${SUBMIT_LIMITS.name} characters`
    )
    .regex(SAFE_TEXT_PATTERN, "Name contains invalid characters"),

  websiteUrl: z
    .string()
    .trim()
    .min(1, "Website is required")
    .max(
      SUBMIT_LIMITS.websiteUrl,
      `URL must be less than ${SUBMIT_LIMITS.websiteUrl} characters`
    )
    .url("Invalid URL")
    .refine(
      (url) => /^https?:\/\//i.test(url),
      "URL must start with http:// or https://"
    ),

  submitterName: z
    .string()
    .trim()
    .min(1, "Your name is required")
    .max(
      SUBMIT_LIMITS.submitterName,
      `Name must be less than ${SUBMIT_LIMITS.submitterName} characters`
    )
    .regex(SAFE_TEXT_PATTERN, "Name contains invalid characters"),

  submitterEmail: z
    .string()
    .trim()
    .toLowerCase()
    .min(1, "Your email is required")
    .max(
      SUBMIT_LIMITS.submitterEmail,
      `Email must be less than ${SUBMIT_LIMITS.submitterEmail} characters`
    )
    .email("Invalid email address"),
});

/** The website field alone, checked when it loses focus before submit. */
export const submitWebsiteUrlSchema = submitToolFieldsSchema.pick({
  websiteUrl: true,
});

const honeypotSubmitSchema = z.object({
  hp: z.string().min(1),
  name: z.string().optional().default(""),
  submitterEmail: z.string().optional().default(""),
  submitterName: z.string().optional().default(""),
  websiteUrl: z.string().optional().default(""),
});

/**
 * A real submission. The form validates against this alone: errors from the
 * union below come from its honeypot branch, not the fields people fill in.
 */
export const submitToolFormSchema = z
  .object({
    hp: z.string().optional().default(""),
  })
  .extend(submitToolFieldsSchema.shape);

export const submitToolSchema = z.union([
  honeypotSubmitSchema,
  submitToolFormSchema,
]);
