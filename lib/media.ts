import "server-only";
import { DeleteObjectCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import { stripURLSubpath } from "@curiousleaf/utils";
import wretch from "wretch";
import { env, isDev, isProd } from "~/env";
import { r2Client } from "~/services/r2";

/**
 * Uploads a file to R2 and returns its public URL.
 * @param file - The file to upload.
 * @param key - The R2 object key.
 * @returns The public URL of the uploaded file.
 */
// Cache uploaded assets for 1 year on the CDN/browser. Files are content-addressed
// (favicon/logo paths change when re-uploaded), so immutable long-lived caching is safe.
const R2_CACHE_CONTROL = "public, max-age=31536000, immutable";

const getR2PublicUrl = (key: string): string =>
  new URL(
    key.split("/").map(encodeURIComponent).join("/"),
    `${env.R2_PUBLIC_URL.replace(/\/+$/, "")}/`
  ).toString();

export const uploadToR2 = async (
  file: Buffer,
  key: string,
  contentType?: string
): Promise<string> => {
  const upload = new Upload({
    client: r2Client,
    params: {
      Bucket: env.R2_BUCKET,
      Key: key,
      Body: file,
      ContentType: contentType,
      CacheControl: R2_CACHE_CONTROL,
    },
    queueSize: 4,
    partSize: 1024 * 1024 * 5,
    leavePartsOnError: false,
  });

  await upload.done();
  return getR2PublicUrl(key);
};

/**
 * Removes a directory from R2.
 * @param directory - The directory to remove.
 * @throws Error if called in non-production environment (safety check)
 */
export const removeR2Directory = async (directory: string) => {
  if (!isProd) {
    console.warn(
      "[removeR2Directory] Skipping deletion in non-production environment"
    );
    return;
  }

  const listCommand = new ListObjectsV2Command({
    Bucket: env.R2_BUCKET,
    Prefix: `${directory}/`,
  });

  let continuationToken: string | undefined;

  do {
    const listResponse = await r2Client.send(listCommand);
    for (const object of listResponse.Contents || []) {
      if (object.Key) {
        const deleteCommand = new DeleteObjectCommand({
          Bucket: env.R2_BUCKET,
          Key: object.Key,
        });
        await r2Client.send(deleteCommand);
      }
    }
    continuationToken = listResponse.NextContinuationToken;
    listCommand.input.ContinuationToken = continuationToken;
  } while (continuationToken);
};

/**
 * Uploads a favicon to R2 and returns its public URL.
 * @param url - The URL of the website to fetch the favicon from.
 * @param storageKey - The R2 object key to upload the favicon to.
 * @returns The public URL of the uploaded favicon.
 */
export const uploadFavicon = async (
  url: string,
  storageKey: string
): Promise<string> => {
  const cleanedUrl = encodeURIComponent(stripURLSubpath(url) ?? "");
  const faviconUrl = `https://www.google.com/s2/favicons?sz=128&domain_url=${cleanedUrl}`;

  try {
    const arrayBuffer = await wretch(faviconUrl)
      .get()
      .badRequest((err) => {
        throw new Error(`Failed to fetch favicon: ${err.message}`);
      })
      .arrayBuffer();

    return await uploadToR2(
      Buffer.from(arrayBuffer),
      `${storageKey}.png`,
      "image/png"
    );
  } catch (error) {
    if (isDev) {
      console.error("Error fetching or uploading favicon:", error);
    }
    throw error;
  }
};

/**
 * Uploads a screenshot to R2 and returns its public URL.
 * @param url - The URL of the website to fetch the screenshot from.
 * @param storageKey - The R2 object key to upload the screenshot to.
 * @returns The public URL of the uploaded screenshot.
 */
export const uploadScreenshot = async (
  url: string,
  storageKey: string
): Promise<string> => {
  const queryParams = new URLSearchParams({
    url,
    access_key: env.SCREENSHOTONE_ACCESS_KEY,
    response_type: "json",

    // Cache
    cache: "true",
    cache_ttl: "2592000",

    // Emulations
    dark_mode: "true",
    reduced_motion: "true",

    // Blockers
    delay: "3",
    block_ads: "true",
    block_chats: "true",
    block_trackers: "true",
    block_cookie_banners: "true",

    // Image and viewport options
    format: "webp",
    viewport_width: "1280",
    viewport_height: "720",

    // Storage options
    store: "true",
    storage_path: storageKey,
    storage_endpoint: env.R2_ENDPOINT,
    storage_bucket: env.R2_BUCKET,
    storage_access_key_id: env.R2_ACCESS_KEY_ID,
    storage_secret_access_key: env.R2_SECRET_ACCESS_KEY,
  });

  try {
    const endpointUrl = `https://api.screenshotone.com/take?${queryParams.toString()}`;
    await wretch(endpointUrl).get().res();
    return `${getR2PublicUrl(`${storageKey}.webp`)}?v=${Date.now()}`;
  } catch (error) {
    if (isDev) {
      console.error("Error fetching screenshot:", error);
    }
    throw error;
  }
};
