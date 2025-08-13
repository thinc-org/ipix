-- Custom SQL migration file, put your code below! --

ALTER TABLE "upload_session"
  ADD COLUMN IF NOT EXISTS "idempotency_key" text;--> statement-breakpoint