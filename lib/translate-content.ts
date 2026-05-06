"use server";

import { generateText } from "ai";
import { logger } from "~/lib/logger";
import { googleFlashModel } from "~/services/google";

const log = logger.ai;

interface TranslationInput {
  content?: string | null;
  description?: string | null;
  name?: string | null;
  pricing?: string | null;
  tagline?: string | null;
}

interface TranslationResult {
  contentVi?: string | null;
  descriptionVi?: string | null;
  nameVi?: string | null;
  pricingVi?: string | null;
  taglineVi?: string | null;
}

/**
 * Translates English content to Vietnamese using Google Gemini model.
 */
export async function translateToVietnamese(
  input: TranslationInput
): Promise<TranslationResult> {
  const fieldsToTranslate: { field: string; text: string }[] = [];

  if (input.name) {
    fieldsToTranslate.push({ field: "name", text: input.name });
  }
  if (input.tagline) {
    fieldsToTranslate.push({ field: "tagline", text: input.tagline });
  }
  if (input.description) {
    fieldsToTranslate.push({ field: "description", text: input.description });
  }
  if (input.content) {
    fieldsToTranslate.push({ field: "content", text: input.content });
  }
  if (input.pricing) {
    fieldsToTranslate.push({ field: "pricing", text: input.pricing });
  }

  if (fieldsToTranslate.length === 0) {
    log.warn("No fields to translate");
    return {};
  }

  try {
    log.info(`Translating ${fieldsToTranslate.length} fields to Vietnamese`);
    log.info(`Fields: ${fieldsToTranslate.map((f) => f.field).join(", ")}`);

    const { text } = await generateText({
      model: googleFlashModel,
      system: `
You are a professional translator specializing in software and technology products.
Translate the following content from English to Vietnamese.

Guidelines:
- Keep brand names and product names in English
- Use natural Vietnamese
- Preserve Markdown formatting if present
- Keep technical terms in English when commonly used (e.g., "API", "SDK", "CI/CD")

Return ONLY the Vietnamese translation, no explanations.
IMPORTANT: Keep the field labels (name, tagline, description, content, pricing) in English exactly as given. Only translate the values.
      `.trim(),
      prompt: `Translate this ${input.name ? "tool" : "content"} to Vietnamese:

${fieldsToTranslate.map((f) => `${f.field}: ${f.text}`).join("\n")}`,
      temperature: 0.3,
    });

    log.info(`Raw translation response: ${text.substring(0, 200)}...`);

    // Parse the response - collect multi-line values between field labels
    const fieldMap: Record<string, keyof TranslationResult> = {
      name: "nameVi",
      tagline: "taglineVi",
      description: "descriptionVi",
      content: "contentVi",
      pricing: "pricingVi",
      tên: "nameVi",
      "phụ đề": "taglineVi",
      "khẩu hiệu": "taglineVi",
      "mô tả": "descriptionVi",
      "nội dung": "contentVi",
      giá: "pricingVi",
      "giá cả": "pricingVi",
    };

    const fieldLabels = Object.keys(fieldMap);
    const result: TranslationResult = {};
    const lines = text.split("\n");

    let currentField: keyof TranslationResult | null = null;
    let currentLines: string[] = [];

    const flushField = () => {
      if (currentField && currentLines.length > 0) {
        result[currentField] = currentLines.join("\n").trim();
      }
    };

    for (const line of lines) {
      // Check if this line starts with a known field label
      const match = fieldLabels.find((label) => {
        const lower = line.toLowerCase();
        return lower.startsWith(`${label}:`) || lower.startsWith(`${label} :`);
      });

      if (match) {
        flushField();
        const colonIndex = line.indexOf(":");
        currentField = fieldMap[match];
        currentLines = [line.slice(colonIndex + 1).trim()];
      } else if (currentField) {
        currentLines.push(line);
      }
    }
    flushField();

    log.info("Translation completed successfully");
    log.info(`Result: ${JSON.stringify(result)}`);
    return result;
  } catch (error) {
    log.error("Translation failed", { error });
    console.error("[translateToVietnamese] Detailed error:", error);
    throw new Error(`Failed to translate content: ${error}`);
  }
}
