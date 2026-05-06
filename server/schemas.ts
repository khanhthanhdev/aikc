import { z } from "zod";

export const submitToolSchema = z.object({
  name: z
    .string()
    .min(1, "Name is required")
    .max(100, "Name must be less than 100 characters"),
  websiteUrl: z
    .string()
    .min(1, "Website is required")
    .url("Invalid URL")
    .max(500, "URL must be less than 500 characters"),
  submitterName: z
    .string()
    .min(1, "Your name is required")
    .max(100, "Name must be less than 100 characters"),
  submitterEmail: z
    .string()
    .min(1, "Your email is required")
    .email("Invalid email address")
    .max(255, "Email must be less than 255 characters"),
});
