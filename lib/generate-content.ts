import "server-only";
import { slugify } from "@curiousleaf/utils";
import type { Tool } from "@prisma/client";
import { generateObject } from "ai";
import type { Jsonify } from "inngest/types";
import { z } from "zod";
import { config } from "~/config";
import { getErrorMessage } from "~/lib/handle-error";
import { logger } from "~/lib/logger";
import { firecrawlClient } from "~/services/firecrawl";
import {
  googleFlashLiteModel,
  googleFlashModel,
  googleNoThinkingProviderOptions,
} from "~/services/google";
import { prisma } from "~/services/prisma";

const log = logger.ai;

/**
 * Generates content for a tool using Google Gemini model.
 * @param tool The tool to generate content for.
 * @returns The generated content.
 */
export const generateContent = async (tool: Tool | Jsonify<Tool>) => {
  log.info(`Generating content for tool: ${tool.name}`, {
    slug: tool.slug,
    url: tool.websiteUrl,
  });

  const model = googleFlashLiteModel;
  const _categories = await prisma.category.findMany();

  try {
    log.debug(`Scraping website: ${tool.websiteUrl}`);
    const scrapedData = await firecrawlClient.scrapeUrl(tool.websiteUrl, {
      formats: ["markdown"],
    });

    if (!scrapedData.success) {
      log.error(`Failed to scrape website: ${tool.websiteUrl}`, {
        error: scrapedData.error,
      });
      throw new Error(scrapedData.error);
    }

    log.debug(
      `Successfully scraped website, content length: ${scrapedData.markdown?.length ?? 0}`
    );

    const schema = z.object({
      tagline: z
        .string()
        .describe(
          "A tagline (up to 60 characters) that captures the essence of the tool. Should not include the tool name."
        ),
      description: z
        .string()
        .describe(
          "A concise description (up to 160 characters) that highlights the main features and benefits. Should not include the tool name."
        ),
      content: z
        .string()
        .describe(
          "A detailed and engaging longer description with key benefits (up to 1000 characters). Can be Markdown formatted, but should start with paragraph and not use headings. Highlight important points with bold text. Make sure the lists use correct Markdown syntax."
        ),
      pricing: z
        .string()
        .describe(
          "The pricing model of the tool. Examples: 'Free', 'Open Source', 'Freemium', 'Paid', 'From $12/mo'. Keep it short."
        ),
      // categories: z
      //   .array(z.string())
      //   .max(2)
      //   .transform(a => a.map(name => categories.find(c => c.name === name)).filter(isTruthy))
      //   .describe("A list of categories for the tool."),
      tags: z
        .array(z.string())
        .max(10)
        .describe(
          "A list (max 10) of tags for the tool. Should be short, lowercase, hyphen-separated and related to software development (e.g. 'code-review', 'testing', 'ci-cd')"
        ),
    });

    const { object } = await generateObject({
      model,
      schema,
      system: `
        You are an expert content creator specializing in Work & Study tool software products.
        Your task is to generate high-quality, engaging content to display on a directory website.
        You do not use any catchphrases like "Empower", "Streamline" etc.
      `,
      //   You also assign the project to specified categories and collections.
      //   DO NOT force it to be in a category or collection if it does not belong to any.
      //   DO NOT assign to any categories or collections that do not exist.
      // `,
      prompt: `
        Provide me details for the following data:
        title: ${scrapedData.metadata?.title}
        description: ${scrapedData.metadata?.description}
        content: ${scrapedData.markdown}
      `,
      //   Here is the list of categories to assign to the tool:
      //   ${categories.map(({ name }) => name).join("\n")}
      // `,
      temperature: 0.3,
      experimental_telemetry: { isEnabled: true },
      providerOptions: googleNoThinkingProviderOptions,
    });

    // Slugify tags after generation (transforms can't be in JSON Schema)
    const result = {
      ...object,
      tags: object.tags?.map((tag) => slugify(tag)),
    };

    log.info(`Content generated successfully for: ${tool.name}`, {
      tagline: result.tagline,
      tagsCount: result.tags?.length,
    });

    return result;
  } catch (error) {
    log.error(`Failed to generate content for: ${tool.name}`, {
      error: getErrorMessage(error),
    });
    throw new Error(getErrorMessage(error));
  }
};

/**
 * Generates a launch tweet for a tool.
 * @param tool The tool to generate a launch tweet for.
 * @returns The launch tweet.
 */
export const generateLaunchTweet = async (tool: Tool | Jsonify<Tool>) => {
  const model = googleFlashModel;

  const { object } = await generateObject({
    model,
    schema: z.object({
      tweet: z.string().max(280).describe("The launch tweet"),
    }),
    system: `
      You are an expert content creator.
      Use new lines to separate paragraphs.
      Tweet should do not exceed 240 characters.
      Use the following template:
      "
      🚀 Just published — {name} ({X handle}): {tagline}

      {description}

      {links}
      "
    `,
    prompt: `
      Generate a tweet to announce the publication of the following Work & Study tool software product:

      Name: "${tool.name}"
      Tagline: "${tool.tagline}"
      Description: "${tool.description}"
      X Handle: "${tool.xHandle}"
      Link: "${config.site.url}/tools/${tool.slug}"
    `,
    experimental_telemetry: { isEnabled: true },
    providerOptions: googleNoThinkingProviderOptions,
  });

  return object;
};
