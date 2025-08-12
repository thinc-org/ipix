-- Custom SQL migration file, put your code below! --

ALTER TABLE "upload_session"
  ADD COLUMN IF NOT EXISTS "space_id" uuid NOT NULL;--> statement-breakpoint

ALTER TABLE "upload_session" ADD CONSTRAINT "upload_session_space_id_space_id_fk" FOREIGN KEY ("space_id") REFERENCES "public"."space"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint