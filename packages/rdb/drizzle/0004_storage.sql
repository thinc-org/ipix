-- Custom SQL migration file, put your code below! --

CREATE TYPE "public"."blob_provider" AS ENUM('aws_s3', 'gcs', 'azure_blob', 'r2', 'minio');--> statement-breakpoint
CREATE TYPE "public"."blob_state" AS ENUM('staging', 'active', 'deleting', 'error');--> statement-breakpoint
CREATE TYPE "public"."blob_storage_class" AS ENUM('standard', 'infrequent_access', 'archive');--> statement-breakpoint
CREATE TYPE "public"."file_state" AS ENUM('placeholder', 'processing', 'verifying', 'ready');--> statement-breakpoint
CREATE TYPE "public"."item_type" AS ENUM('file', 'folder');--> statement-breakpoint
CREATE TYPE "public"."space_type" AS ENUM('personal', 'team');--> statement-breakpoint
CREATE TYPE "public"."transfer_status" AS ENUM('initiated', 'in_progress', 'completed', 'aborted', 'failed');--> statement-breakpoint
CREATE TABLE "access_rank" (
	"access_type" text PRIMARY KEY NOT NULL,
	"rank" smallint NOT NULL,
	CONSTRAINT "access_rank_rank_unique" UNIQUE("rank"),
	CONSTRAINT "chk_rank_positive" CHECK ("access_rank"."rank" > 0)
);
--> statement-breakpoint
CREATE TABLE "file_asset" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7_sub_ms() NOT NULL,
	"sha256" "bytea" NOT NULL,
	"sha256_hex" text GENERATED ALWAYS AS (encode(sha256, 'hex')) STORED,
	"sha256_prefix12" "bytea" GENERATED ALWAYS AS (substring(sha256 from 1 for 12)) STORED NOT NULL,
	"sha256_hex12" text GENERATED ALWAYS AS (substring(encode(sha256, 'hex') for 12)) STORED,
	"size_byte" bigint NOT NULL,
	"content_type" "citext" NOT NULL,
	"width_px" integer,
	"height_px" integer,
	"exif" jsonb,
	"taken_at" timestamp with time zone,
	"taken_src" text,
	"taken_local" text,
	"taken_offset_min" smallint,
	"taken_subsec" smallint,
	"camera_make" "citext",
	"camera_model" "citext",
	"lens_make" "citext",
	"lens_model" "citext",
	"iso" integer,
	"f_number" numeric(4,2),
	"exposure_time_num" integer,
	"exposure_time_den" integer,
	"focal_len_mm" numeric(6,2),
	"focal_len_35mm" numeric(6,2),
	"exposure_bias_ev" numeric(5,2),
	"flash_fired" boolean,
	"metering_mode" smallint,
	"exposure_program" smallint,
	"orientation" smallint,
	"rotation_deg" smallint,
	"color_space" text,
	"bit_depth" smallint,
	"has_icc" boolean,
	"gps_geom" geometry(Point, 4326),
	"gps_geog" geography(Point, 4326) GENERATED ALWAYS AS ((gps_geom)::geography) STORED,
	"gps_alt_m" numeric(8,2),
	"gps_dop" numeric(6,2),
	"gps_timestamp" timestamp with time zone,
	"duration_ms" bigint,
	"video_rotation_deg" smallint,
	"frame_rate" numeric(6,3),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chk_sha256_is_32_bytes" CHECK (octet_length("file_asset"."sha256") = 32),
	CONSTRAINT "chk_asset_size_nonneg" CHECK ("file_asset"."size_byte" >= 0),
	CONSTRAINT "chk_dims_positive" CHECK (
        ("file_asset"."width_px" IS NULL OR "file_asset"."width_px" > 0)
        AND ("file_asset"."height_px" IS NULL OR "file_asset"."height_px" > 0)
      ),
	CONSTRAINT "chk_dims_pair" CHECK (
      ("file_asset"."width_px" IS NULL AND "file_asset"."height_px" IS NULL) OR ("file_asset"."width_px" IS NOT NULL AND "file_asset"."height_px" IS NOT NULL)
      ),
	CONSTRAINT "chk_rotation_deg_valid" CHECK ("file_asset"."rotation_deg" IN (0, 90, 180, 270) OR "file_asset"."rotation_deg" IS NULL),
	CONSTRAINT "chk_video_rotation_deg_valid" CHECK ("file_asset"."video_rotation_deg" IN (0, 90, 180, 270) OR "file_asset"."video_rotation_deg" IS NULL),
	CONSTRAINT "chk_taken_subsec" CHECK ("file_asset"."taken_subsec" BETWEEN 0 AND 999 OR "file_asset"."taken_subsec" IS NULL),
	CONSTRAINT "chk_orientation_range" CHECK ("file_asset"."orientation" IS NULL OR "file_asset"."orientation" BETWEEN 1 AND 8),
	CONSTRAINT "chk_fnumber_positive" CHECK ("file_asset"."f_number" IS NULL OR "file_asset"."f_number"::numeric > 0),
	CONSTRAINT "chk_bit_depth_positive" CHECK ("file_asset"."bit_depth" IS NULL OR "file_asset"."bit_depth" > 0),
	CONSTRAINT "chk_taken_offset_range" CHECK ("file_asset"."taken_offset_min" BETWEEN -1080 AND 1080 OR "file_asset"."taken_offset_min" IS NULL),
	CONSTRAINT "chk_duration_ms_nonneg" CHECK ("file_asset"."duration_ms" IS NULL OR "file_asset"."duration_ms" >= 0),
	CONSTRAINT "chk_frame_rate_positive" CHECK ("file_asset"."frame_rate" IS NULL OR ("file_asset"."frame_rate"::numeric > 0)),
	CONSTRAINT "chk_exif_is_object" CHECK ("file_asset"."exif" IS NULL OR jsonb_typeof("file_asset"."exif") = 'object')
);
--> statement-breakpoint
CREATE TABLE "file_blob_location" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7_sub_ms() NOT NULL,
	"asset_id" uuid NOT NULL,
	"provider" "blob_provider" NOT NULL,
	"region" text,
	"bucket" "citext" NOT NULL,
	"object_key" text NOT NULL,
	"version_id" text,
	"is_primary" boolean DEFAULT false NOT NULL,
	"state" "blob_state" DEFAULT 'active' NOT NULL,
	"storage_class" "blob_storage_class",
	"etag" text,
	"kms_key_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"verified_at" timestamp with time zone,
	"last_access_at" timestamp with time zone,
	CONSTRAINT "chk_bucket_lower" CHECK ("file_blob_location"."bucket" = lower("file_blob_location"."bucket")),
	CONSTRAINT "chk_key_len" CHECK (octet_length("file_blob_location"."object_key") BETWEEN 1 AND 1024)
);
--> statement-breakpoint
CREATE TABLE "item" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7_sub_ms() NOT NULL,
	"parent_id" uuid,
	"space_id" uuid NOT NULL,
	"created_by" uuid NOT NULL,
	"name" "citext" NOT NULL,
	"mime_type" "citext",
	"size_byte" bigint,
	"item_type" "item_type" NOT NULL,
	"asset_id" uuid,
	"purge_at" timestamp with time zone,
	"trashed_at" timestamp with time zone,
	"access_type" text DEFAULT 'owner' NOT NULL,
	"file_state" "file_state",
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chk_item_consistency_semantics" CHECK (
      CASE
        WHEN "item"."item_type" = 'folder' THEN "item"."mime_type" IS NULL AND "item"."size_byte" IS NULL AND "item"."file_state" IS NULL
        WHEN "item"."item_type" = 'file' THEN
          (
            ("item"."file_state" IN ('placeholder','processing','verifying') AND "item"."size_byte" IS NULL)
            OR
            ("item"."file_state" = 'ready' AND "item"."size_byte" IS NOT NULL AND "item"."mime_type" IS NOT NULL)
          )
        ELSE FALSE
      END
    ),
	CONSTRAINT "chk_item_not_self_parent" CHECK ("item"."parent_id" IS NULL OR "item"."parent_id" <> "item"."id"),
	CONSTRAINT "chk_size_non_negative" CHECK ("item"."size_byte" IS NULL OR "item"."size_byte" >= 0::bigint),
	CONSTRAINT "chk_item_name_not_blank" CHECK (btrim("item"."name") <> ''),
	CONSTRAINT "chk_valid_update_at" CHECK ("item"."created_at" <= "item"."updated_at"),
	CONSTRAINT "chk_valid_delete_dt" CHECK ("item"."purge_at" IS NULL OR ("item"."trashed_at" IS NOT NULL AND "item"."purge_at" > "item"."created_at" AND "item"."purge_at" > "item"."trashed_at")),
	CONSTRAINT "chk_valid_trashed_at" CHECK ("item"."trashed_at" IS NULL OR "item"."trashed_at" >= "item"."created_at"),
	CONSTRAINT "chk_item_access_lower" CHECK ("item"."access_type" = lower("item"."access_type")),
	CONSTRAINT "chk_root_non_trashable" CHECK ("item"."parent_id" IS NOT NULL OR ("item"."item_type" = 'folder' AND "item"."trashed_at" IS NULL AND "item"."purge_at" IS NULL))
);
--> statement-breakpoint
CREATE TABLE "item_effective_access" (
	"id" uuid PRIMARY KEY NOT NULL,
	"space_id" uuid NOT NULL,
	"effective_rank" smallint NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "item_effective_recalc_queue" (
	"txid" bigint NOT NULL,
	"id" uuid NOT NULL,
	"enqueued_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "item_effective_recalc_queue_txid_id_pk" PRIMARY KEY("txid","id")
);
--> statement-breakpoint
CREATE TABLE "space" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7_sub_ms() NOT NULL,
	"name" "citext" NOT NULL,
	"ownership_type" "space_type" DEFAULT 'personal' NOT NULL,
	"root_folder_id" uuid NOT NULL,
	"created_by" uuid,
	"owned_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_space_owner_name" UNIQUE("owned_by","name","ownership_type"),
	CONSTRAINT "chk_valid_update_at" CHECK ("space"."created_at" <= "space"."updated_at")
);
--> statement-breakpoint
CREATE TABLE "upload_session" (
	"key" uuid PRIMARY KEY DEFAULT uuidv7_sub_ms() NOT NULL,
	"item_id" uuid NOT NULL,
	"upload_id" varchar(512) NOT NULL,
	"status" "transfer_status" DEFAULT 'initiated' NOT NULL,
	"expected_size" bigint NOT NULL,
	"content_type" "citext" DEFAULT 'application/octet-stream',
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	CONSTRAINT "chk_expected_size_nonneg" CHECK ("upload_session"."expected_size" >= 0),
	CONSTRAINT "chk_valid_update_at" CHECK ("upload_session"."created_at" <= "upload_session"."updated_at"),
	CONSTRAINT "chk_valid_complete_at" CHECK ("upload_session"."completed_at" IS NULL OR "upload_session"."created_at" <= "upload_session"."completed_at"),
	CONSTRAINT "chk_upload_completed_at_sync" CHECK (("upload_session"."completed_at" IS NULL) = ("upload_session"."status" <> 'completed'))
);
--> statement-breakpoint
ALTER TABLE "file_blob_location" ADD CONSTRAINT "file_blob_location_asset_id_file_asset_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."file_asset"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item" ADD CONSTRAINT "item_space_id_space_id_fk" FOREIGN KEY ("space_id") REFERENCES "public"."space"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item" ADD CONSTRAINT "item_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item" ADD CONSTRAINT "item_access_type_fk" FOREIGN KEY ("access_type") REFERENCES "public"."access_rank"("access_type") ON DELETE no action ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "item" ADD CONSTRAINT "item_parent_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."item"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item" ADD CONSTRAINT "item_asset_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."file_asset"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_effective_access" ADD CONSTRAINT "item_effective_access_id_item_id_fk" FOREIGN KEY ("id") REFERENCES "public"."item"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_effective_access" ADD CONSTRAINT "item_effective_access_space_id_space_id_fk" FOREIGN KEY ("space_id") REFERENCES "public"."space"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "space" ADD CONSTRAINT "space_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "space" ADD CONSTRAINT "space_owned_by_user_id_fk" FOREIGN KEY ("owned_by") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "space" ADD CONSTRAINT "space_root_folder_id_fkey" FOREIGN KEY ("root_folder_id") REFERENCES "public"."item"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "upload_session" ADD CONSTRAINT "upload_session_item_id_item_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."item"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_file_asset_taken_at" ON "file_asset" USING btree ("taken_at");--> statement-breakpoint
CREATE INDEX "idx_file_asset_sha12" ON "file_asset" USING btree ("sha256_prefix12");--> statement-breakpoint
CREATE INDEX "idx_file_asset_gps_geom" ON "file_asset" USING gist ("gps_geom");--> statement-breakpoint
CREATE INDEX "idx_file_asset_gps_geog" ON "file_asset" USING gist ("gps_geog");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_file_asset_sha256" ON "file_asset" USING btree ("sha256");--> statement-breakpoint
CREATE INDEX "idx_blob_by_asset" ON "file_blob_location" USING btree ("asset_id");--> statement-breakpoint
CREATE INDEX "idx_blob_state" ON "file_blob_location" USING btree ("state");--> statement-breakpoint
CREATE INDEX "idx_blob_bucket_key" ON "file_blob_location" USING btree ("provider","bucket","object_key");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_blob_primary_per_asset" ON "file_blob_location" USING btree ("asset_id") WHERE "file_blob_location"."is_primary" = true;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_blob_phys_unversioned_regnull" ON "file_blob_location" USING btree ("provider","bucket","object_key") WHERE "file_blob_location"."version_id" IS NULL AND "file_blob_location"."region" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_blob_phys_unversioned_regset" ON "file_blob_location" USING btree ("provider","region","bucket","object_key") WHERE "file_blob_location"."version_id" IS NULL AND "file_blob_location"."region" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_blob_phys_versioned_regnull" ON "file_blob_location" USING btree ("provider","bucket","object_key","version_id") WHERE "file_blob_location"."version_id" IS NOT NULL AND "file_blob_location"."region" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_blob_phys_versioned_regset" ON "file_blob_location" USING btree ("provider","region","bucket","object_key","version_id") WHERE "file_blob_location"."version_id" IS NOT NULL AND "file_blob_location"."region" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "idx_item_space" ON "item" USING btree ("space_id");--> statement-breakpoint
CREATE INDEX "idx_item_parent" ON "item" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "idx_item_created_by" ON "item" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "idx_item_name_trgm" ON "item" USING gin ((("name")::text) gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "idx_item_asset_nn" ON "item" USING btree ("asset_id") WHERE "item"."asset_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "idx_space_item_browse_live_type_name" ON "item" USING btree ("space_id","parent_id",("item_type" = 'folder') DESC,"name") WHERE "item"."trashed_at" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_item_browse_live_type_name" ON "item" USING btree ("parent_id",("item_type" = 'folder') DESC,"name") WHERE "item"."trashed_at" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_space_item_browse_live_updated" ON "item" USING btree ("space_id","parent_id","updated_at") WHERE "item"."trashed_at" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_item_space_not_trashed" ON "item" USING btree ("space_id") WHERE "item"."trashed_at" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_item_space_trashed" ON "item" USING btree ("space_id") WHERE "item"."trashed_at" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "idx_item_parent_trash_type_name" ON "item" USING btree ("parent_id","item_type","name") WHERE "item"."trashed_at" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "idx_item_parent_live_updated" ON "item" USING btree ("parent_id","updated_at") WHERE "item"."trashed_at" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_item_parent_trash_name" ON "item" USING btree ("parent_id","name") WHERE "item"."trashed_at" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "idx_item_access_type" ON "item" USING btree ("access_type");--> statement-breakpoint
CREATE INDEX "idx_item_expire" ON "item" USING btree ("purge_at") WHERE "item"."purge_at" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "idx_iea_space" ON "item_effective_access" USING btree ("space_id");--> statement-breakpoint
CREATE INDEX "idx_iea_space_rank" ON "item_effective_access" USING btree ("space_id","effective_rank");--> statement-breakpoint
CREATE INDEX "idx_ierq_enqueue" ON "item_effective_recalc_queue" USING btree ("enqueued_at");--> statement-breakpoint
CREATE INDEX "idx_space_created_by" ON "space" USING btree ("created_by");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_space_root_folder" ON "space" USING btree ("root_folder_id");--> statement-breakpoint
CREATE INDEX "idx_upload_session_stale" ON "upload_session" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_upload_session_item" ON "upload_session" USING btree ("item_id");--> statement-breakpoint
CREATE INDEX "idx_upload_session_item_active" ON "upload_session" USING btree ("item_id") WHERE "upload_session"."status" IN ('initiated','in_progress');--> statement-breakpoint
CREATE INDEX "idx_upload_session_stale_active" ON "upload_session" USING btree ("created_at") WHERE "upload_session"."status" IN ('initiated','in_progress');--> statement-breakpoint
CREATE INDEX "idx_upload_session_upload_id" ON "upload_session" USING btree ("upload_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_upload_item_provider" ON "upload_session" USING btree ("item_id","upload_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_upload_active" ON "upload_session" USING btree ("item_id") WHERE "upload_session"."status" IN ('initiated','in_progress');