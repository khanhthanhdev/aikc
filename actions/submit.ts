"use server";

import { slugify } from "@curiousleaf/utils";
import { headers } from "next/headers";
import { createServerAction } from "zsa";
import { validateLink } from "~/lib/link-validator";
import {
  getClientIpFromHeaders,
  rateLimitByAddressMulti,
} from "~/lib/rate-limit";
import { submitToolSchema } from "~/server/schemas";
import { prisma } from "~/services/prisma";
import { sanitizeText, sanitizeUrl } from "~/utils/helpers";

/**
 * Structured server error with field-level binding.
 * The client maps `field` to the matching form field for inline display.
 */
class SubmitError extends Error {
  field: string;

  constructor(field: string, message: string) {
    super(message);
    this.field = field;
    this.name = "SubmitError";
  }
}

/**
 * Generates a unique slug by adding a numeric suffix if needed
 */
const generateUniqueSlug = async (baseName: string): Promise<string> => {
  const baseSlug = slugify(baseName);
  let slug = baseSlug;
  let suffix = 2;

  while (true) {
    // Check if slug exists
    if (!(await prisma.tool.findUnique({ where: { slug } }))) {
      return slug;
    }

    // Add/increment suffix and try again
    slug = `${baseSlug}-${suffix}`;
    suffix++;
  }
};

/**
 * Submit a tool to the database
 * @param input - The tool data to submit
 * @returns The tool that was submitted
 */
export const submitTool = createServerAction()
  .input(submitToolSchema)
  .handler(async ({ input }) => {
    // Reject honeypot — silently pretend success to not tip off bots
    if (input.hp) {
      return { slug: "", name: "", publishedAt: null } as const;
    }

    // Per-IP submit rate limit: 3 / 10 min and 20 / day
    if (process.env.NODE_ENV !== "development") {
      const ip = getClientIpFromHeaders(await headers());
      const limit = rateLimitByAddressMulti(ip, [
        { scope: "submit:10min", limit: 3, windowSeconds: 10 * 60 },
        { scope: "submit:day", limit: 20, windowSeconds: 24 * 60 * 60 },
      ]);
      if (!limit.success) {
        const retryAfter = Math.max(
          1,
          Math.ceil((limit.resetAt - Date.now()) / 1000)
        );
        throw new SubmitError(
          "websiteUrl",
          `Too many submissions from this IP. Please try again in ${retryAfter} seconds.`
        );
      }
    }

    const name = sanitizeText(input.name, 100);
    const submitterName = sanitizeText(input.submitterName, 100);
    const submitterEmail = sanitizeText(input.submitterEmail, 255);
    const websiteUrl = sanitizeUrl(input.websiteUrl);

    if (!websiteUrl) {
      throw new SubmitError(
        "websiteUrl",
        "Invalid URL: unsafe or unsupported protocol"
      );
    }

    // Check if the tool already exists
    const existingTool = await prisma.tool.findFirst({
      where: { websiteUrl },
    });

    // If the tool exists, redirect to the tool or submit page
    if (existingTool) {
      return existingTool;
    }

    // Validate that the link is reachable
    const linkValidation = await validateLink(websiteUrl);
    if (!linkValidation.isValid) {
      throw new SubmitError(
        "websiteUrl",
        linkValidation.error === "URL points to private/internal network"
          ? "Invalid URL: cannot submit internal/private network addresses"
          : `We couldn't reach this link: ${linkValidation.error}`
      );
    }

    // Generate a unique slug
    const slug = await generateUniqueSlug(name);

    // Save the tool to the database
    const tool = await prisma.tool.create({
      data: { name, submitterName, submitterEmail, websiteUrl, slug },
    });

    // Tool is saved to queue - admin will trigger pipeline via "Process" action
    return tool;
  });
