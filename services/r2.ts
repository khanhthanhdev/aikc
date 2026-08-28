import { S3Client } from "@aws-sdk/client-s3";
import { env } from "~/env";
export const r2Client = new S3Client({
  region: "auto",
  endpoint: env.R2_ENDPOINT,
  maxAttempts: 5,
  retryMode: "standard",
  credentials: {
    accessKeyId: env.R2_ACCESS_KEY_ID,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY,
  },
});
