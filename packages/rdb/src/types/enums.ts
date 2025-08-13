import { pgEnum } from "drizzle-orm/pg-core";

export const spaceTypeEnum = pgEnum("space_type", ["personal", "team"]);
export const itemTypeEnum = pgEnum("item_type", ["file", "folder"]);
export const transferStatus = pgEnum("transfer_status", [
  "initiated",
  "in_progress",
  "completed",
  "aborted",
  "failed",
]);
export const fileStateEnum = pgEnum("file_state", [
  "placeholder",
  "processing",
  "verifying",
  "ready",
]);
export const blobProviderEnum = pgEnum("blob_provider", [
  "aws_s3",
  "gcs",
  "azure_blob",
  "r2",
  "minio",
]);
export const blobStateEnum = pgEnum("blob_state", [
  "staging",
  "active",
  "deleting",
  "error",
]);
export const blobStorageClassEnum = pgEnum("blob_storage_class", [
  "standard",
  "infrequent_access",
  "archive",
]);
export const blobLocKindEnum = pgEnum("blob_loc_kind", ["canon", "preview"]);
export const checksumMode = pgEnum("checksum_mode", [
  "s3_sha256",
  "client_sha256",
  "none",
]);