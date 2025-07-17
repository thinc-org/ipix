import { S3Client } from "@aws-sdk/client-s3";
import { STSClient, GetFederationTokenCommand } from "@aws-sdk/client-sts";

const {
  S3_REGION,
  S3_ENDPOINT,
  S3_BUCKET,
  ACCESS_KEY_ID,
  SECRET_ACCESS_KEY,
  FORCE_PATH_STYLE,
  ACCESS_CONTROL_ALLOW_ORIGIN,
  PRE_SIGNED_URL_EXPIRE_IN, // in seconds
} = Bun.env;

const requiredEnvVars = {
  S3_REGION,
  S3_ENDPOINT,
  S3_BUCKET,
  ACCESS_KEY_ID,
  SECRET_ACCESS_KEY,
  FORCE_PATH_STYLE,
  ACCESS_CONTROL_ALLOW_ORIGIN,
  PRE_SIGNED_URL_EXPIRE_IN,
};

for (const [key, value] of Object.entries(requiredEnvVars)) {
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
}

function createS3Client(): S3Client {
  if (!S3_ENDPOINT || !ACCESS_KEY_ID || !SECRET_ACCESS_KEY) {
    throw new Error("Missing required S3 environment variables");
  }

  return new S3Client({
    endpoint: S3_ENDPOINT,
    region: S3_REGION,
    credentials: {
      accessKeyId: ACCESS_KEY_ID,
      secretAccessKey: SECRET_ACCESS_KEY,
    },
    forcePathStyle: FORCE_PATH_STYLE === "true",
  });
}

function createSTSClient(): STSClient {
  if (!S3_ENDPOINT || !ACCESS_KEY_ID || !SECRET_ACCESS_KEY) {
    throw new Error("Missing required STS environment variables");
  }
  return new STSClient({
    endpoint: S3_ENDPOINT,
    region: S3_REGION,
    credentials: {
      accessKeyId: ACCESS_KEY_ID,
      secretAccessKey: SECRET_ACCESS_KEY,
    },
  });
}

export const accessControlAllowOrigin = ACCESS_CONTROL_ALLOW_ORIGIN as string;
export const expiresIn = Number(PRE_SIGNED_URL_EXPIRE_IN);
export const s3Bucket = S3_BUCKET as string
export const s3Region = S3_REGION as string
export const s3Endpoint = S3_ENDPOINT as string

export const s3 = createS3Client();
export const sts = createSTSClient();
