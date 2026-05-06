import { readFile } from "node:fs/promises";
import { join } from "node:path";

/**
 * Load a local font file for use in ImageResponse (Open Graph images)
 * @param fontName - The font name to load
 * @param weight - The font weight (400 or 600)
 * @returns ArrayBuffer containing the font data
 */
export const loadLocalFont = async (
  fontName: "GeistSans" | "UncutSans",
  _weight: 400 | 600
): Promise<ArrayBuffer> => {
  const relativePath =
    fontName === "GeistSans"
      ? "public/_static/fonts/GeistSans-Variable.woff2"
      : "public/_static/fonts/UncutSans-Variable.woff2";

  const absPath = join(process.cwd(), relativePath);
  const data = await readFile(absPath);
  return data.buffer as ArrayBuffer;
};
