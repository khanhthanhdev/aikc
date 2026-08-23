import "server-only";
import { DeleteObjectCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import { stripURLSubpath } from "@curiousleaf/utils";
import wretch from "wretch";
import { env, isDev, isProd } from "~/env";
import { s3Client } from "~/services/aws-s3";

/**
 * Uploads a file to S3 and returns the S3 location.
 * @param file - The file to upload.
 * @param key - The S3 key to upload the file to.
 * @returns The S3 location of the uploaded file.
 */
// Cache uploaded assets for 1 year on the CDN/browser. Files are content-addressed
// (favicon/logo paths change when re-uploaded), so immutable long-lived caching is safe.
const S3_CACHE_CONTROL = "public, max-age=31536000, immutable";

export const uploadToS3Storage = async (
  file: Buffer,
  key: string,
  contentType?: string
) => {
  const upload = new Upload({
    client: s3Client,
    params: {
      Bucket: env.S3_BUCKET,
      Key: key,
      Body: file,
      ContentType: contentType,
      CacheControl: S3_CACHE_CONTROL,
      StorageClass: "STANDARD",
    },
    queueSize: 4,
    partSize: 1024 * 1024 * 5,
    leavePartsOnError: false,
  });

  const result = await upload.done();

  if (!result.Location) {
    throw new Error("Failed to upload");
  }

  return result.Location.replace(
    `s3.${env.S3_REGION}.amazonaws.com/${env.S3_BUCKET}`,
    `${env.S3_BUCKET}.s3.${env.S3_REGION}.amazonaws.com`
  );
};

/**
 * Removes a directory from S3.
 * @param directory - The directory to remove.
 * @throws Error if called in non-production environment (safety check)
 */
export const removeS3Directory = async (directory: string) => {
  if (!isProd) {
    console.warn(
      "[removeS3Directory] Skipping deletion in non-production environment"
    );
    return;
  }

  const listCommand = new ListObjectsV2Command({
    Bucket: env.S3_BUCKET,
    Prefix: `${directory}/`,
  });

  let continuationToken: string | undefined;

  do {
    const listResponse = await s3Client.send(listCommand);
    for (const object of listResponse.Contents || []) {
      if (object.Key) {
        const deleteCommand = new DeleteObjectCommand({
          Bucket: env.S3_BUCKET,
          Key: object.Key,
        });
        await s3Client.send(deleteCommand);
      }
    }
    continuationToken = listResponse.NextContinuationToken;
    listCommand.input.ContinuationToken = continuationToken;
  } while (continuationToken);
};

/**
 * Uploads a favicon to S3 and returns the S3 location.
 * @param url - The URL of the website to fetch the favicon from.
 * @param s3Key - The S3 key to upload the favicon to.
 * @returns The S3 location of the uploaded favicon.
 */
export const uploadFavicon = async (
  url: string,
  s3Key: string
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

    // Convert response to Buffer
    const buffer = Buffer.from(arrayBuffer);

    // Upload to S3
    const s3Location = await uploadToS3Storage(
      buffer,
      `${s3Key}.png`,
      "image/png"
    );

    return s3Location;
  } catch (error) {
    if (isDev) {
      console.error("Error fetching or uploading favicon:", error);
    }
    throw error;
  }
};

/**
 * Captures a website screenshot from the internal screenshot service.
 * @param url - The URL of the website to capture.
 * @returns The PNG image.
 */
export const captureScreenshot = async (url: string): Promise<Buffer> => {
  const queryParams = new URLSearchParams({
    url,
    secret: env.SCREENSHOT_SERVICE_SECRET,
    width: "1280",
    height: "720",
    scaleFactor: "1",
    type: "png",
    delay: "3",
    disableAnimations: "true",
    blockAds: "true",
  });
  const endpointUrl = new URL("/capture", env.SCREENSHOT_SERVICE_URL);
  endpointUrl.search = queryParams.toString();

  const image = await wretch(endpointUrl.toString()).get().arrayBuffer();
  return Buffer.from(image);
};

/**
 * Uploads a screenshot to S3 and returns the S3 location.
 * @param url - The URL of the website to capture.
 * @param s3Key - The S3 key to upload the screenshot to.
 * @returns The S3 location of the uploaded screenshot.
 */
export const uploadScreenshot = async (
  url: string,
  s3Key: string
): Promise<string> => {
  try {
    const location = await uploadToS3Storage(
      await captureScreenshot(url),
      `${s3Key}.png`,
      "image/png"
    );

    // Append version timestamp for cache busting
    return `${location}?v=${Date.now()}`;
  } catch (error) {
    if (isDev) {
      console.error("Error capturing or uploading screenshot:", error);
    }
    throw error;
  }
};
