#!/usr/bin/env bun
/**
 * Backfills the `Cache-Control` header on every object in the configured S3 bucket.
 *
 * Lighthouse flags assets in our public S3 bucket because they are served with no
 * cache lifetime. New uploads get `Cache-Control: public, max-age=31536000, immutable`
 * via `uploadToS3Storage`, but existing objects (uploaded before that change) still
 * have no cache headers. This script copies each object onto itself with the new
 * metadata, which is the standard S3 way to update headers on existing files.
 *
 * Usage:
 *   bun run scripts/backfill-s3-cache-control.ts            # all objects
 *   bun run scripts/backfill-s3-cache-control.ts ads/       # only a prefix
 */
import {
  CopyObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
} from "@aws-sdk/client-s3";
import { env } from "~/env";
import { s3Client } from "~/services/aws-s3";

const CACHE_CONTROL = "public, max-age=31536000, immutable";

async function main() {
  const prefix = process.argv[2] ?? "";
  const bucket = env.S3_BUCKET;

  console.log(
    `🔧 Backfilling Cache-Control on s3://${bucket}/${prefix || "(all)"}`
  );
  console.log(`   New header: ${CACHE_CONTROL}`);

  let continuationToken: string | undefined;
  let scanned = 0;
  let updated = 0;
  let skipped = 0;
  let failed = 0;

  do {
    const list = await s3Client.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: prefix || undefined,
        ContinuationToken: continuationToken,
      })
    );

    for (const object of list.Contents ?? []) {
      const key = object.Key;
      if (!key) {
        continue;
      }
      scanned++;

      try {
        const head = await s3Client.send(
          new HeadObjectCommand({ Bucket: bucket, Key: key })
        );

        if (head.CacheControl === CACHE_CONTROL) {
          skipped++;
          continue;
        }

        await s3Client.send(
          new CopyObjectCommand({
            Bucket: bucket,
            Key: key,
            CopySource: `${bucket}/${encodeURIComponent(key)}`,
            MetadataDirective: "REPLACE",
            CacheControl: CACHE_CONTROL,
            ContentType: head.ContentType,
            StorageClass: "STANDARD",
          })
        );
        updated++;
        if (updated % 50 === 0) {
          console.log(`   …updated ${updated} objects so far`);
        }
      } catch (error) {
        failed++;
        console.error(`❌ Failed to update ${key}:`, error);
      }
    }

    continuationToken = list.NextContinuationToken;
  } while (continuationToken);

  console.log("\n✅ Done.");
  console.log(`   Scanned: ${scanned}`);
  console.log(`   Updated: ${updated}`);
  console.log(`   Already correct: ${skipped}`);
  console.log(`   Failed: ${failed}`);
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
