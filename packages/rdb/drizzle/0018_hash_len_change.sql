-- Custom SQL migration file, put your code below! --

DROP INDEX "idx_file_asset_sha12";

ALTER TABLE "file_asset"
  DROP COLUMN "sha256_prefix12";

ALTER TABLE "file_asset"
  DROP COLUMN "sha256_hex12";

ALTER TABLE "file_asset"
  ADD COLUMN "sha256_prefix24" "bytea" GENERATED ALWAYS AS (substring(sha256 from 1 for 24)) STORED NOT NULL;

ALTER TABLE "file_asset"
  ADD COLUMN "sha256_hex24" text GENERATED ALWAYS AS (substring(encode(sha256, 'hex') for 24)) STORED;

CREATE INDEX "idx_file_asset_sha24" ON "file_asset" USING btree ("sha256_prefix24");--> statement-breakpoint