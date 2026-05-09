import { z } from "zod";

export const SUBMIT_LIMITS = {
  name: 100,
  websiteUrl: 500,
  submitterName: 100,
  submitterEmail: 255,
} as const;

const SAFE_TEXT_PATTERN = /^[^<>"'&]*$/;

export const submitToolSchema = z.object({
  // Honeypot field — validated permissively so bots reach silent rejection.
  hp: z.string().optional().default(""),

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
