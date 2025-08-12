-- Custom SQL migration file, put your code below! --

CREATE TYPE "public"."checksum_mode" AS ENUM('s3_sha256', 'client_sha256', 'none');--> statement-breakpoint

ALTER TABLE "upload_session"
  ADD COLUMN IF NOT EXISTS "kms_key_id" text,
  ADD COLUMN IF NOT EXISTS "checksum_mode" "checksum_mode" NOT NULL;--> statement-breakpoint