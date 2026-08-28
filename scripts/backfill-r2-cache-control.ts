#!/usr/bin/env bun
/**
 * Backfills the `Cache-Control` header on every object in the configured R2 bucket.
 *
 * Lighthouse flags assets served from R2 without a cache lifetime. New uploads set
 * `Cache-Control: public, max-age=31536000, immutable` via `uploadToR2Storage`;
 * this script copies older objects onto themselves with the same header.
 *
 * Usage:
 *   bun run scripts/backfill-r2-cache-control.ts            # all objects
 *   bun run scripts/backfill-r2-cache-control.ts ads/       # only a prefix
 */
import {
  CopyObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
} from "@aws-sdk/client-s3";
import { env } from "~/env";
import { r2Client } from "~/services/r2";

const CACHE_CONTROL = "public, max-age=31536000, immutable";

async function main() {
  const prefix = process.argv[2] ?? "";
  const bucket = env.R2_BUCKET;

  console.log(
    `Backfilling Cache-Control on R2 bucket ${bucket}/${prefix || "(all)"}`
  );
  console.log(`   New header: ${CACHE_CONTROL}`);

  let continuationToken: string | undefined;
  let scanned = 0;
  let updated = 0;
  let skipped = 0;
  let failed = 0;

  do {
    const list = await r2Client.send(
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
        const head = await r2Client.send(
          new HeadObjectCommand({ Bucket: bucket, Key: key })
        );

        if (head.CacheControl === CACHE_CONTROL) {
          skipped++;
          continue;
        }

        await r2Client.send(
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
        console.error(`Failed to update ${key}:`, error);
      }
    }

    continuationToken = list.NextContinuationToken;
  } while (continuationToken);

  console.log("\nDone.");
  console.log(`   Scanned: ${scanned}`);
  console.log(`   Updated: ${updated}`);
  console.log(`   Already correct: ${skipped}`);
  console.log(`   Failed: ${failed}`);
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
