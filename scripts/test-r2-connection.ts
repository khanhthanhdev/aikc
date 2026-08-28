#!/usr/bin/env bun
import { ListObjectsV2Command } from "@aws-sdk/client-s3";
import { env } from "~/env";
import { r2Client } from "~/services/r2";

const result = await r2Client.send(
  new ListObjectsV2Command({ Bucket: env.R2_BUCKET, MaxKeys: 1 })
);

console.log(
  `Connected to R2 bucket "${env.R2_BUCKET}" (${result.KeyCount ?? 0} object returned).`
);
