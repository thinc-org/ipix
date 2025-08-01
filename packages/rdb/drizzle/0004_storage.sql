CREATE TABLE "access_rank" (
	"access_type" "access_type" PRIMARY KEY NOT NULL,
	"rank" smallint NOT NULL,
	CONSTRAINT "access_rank_rank_unique" UNIQUE("rank"),
	CONSTRAINT "chk_rank_positive" CHECK ("access_rank"."rank" > 0),
	CONSTRAINT "chk_rank_matches_enum" CHECK (
       ("access_rank"."access_type" = 'public' AND "access_rank"."rank" = 1000)
    OR ("access_rank"."access_type" = 'team'   AND "access_rank"."rank" = 2000)
    OR ("access_rank"."access_type" = 'owner'  AND "access_rank"."rank" = 3000)
    )
);
--> statement-breakpoint

/* CUSTOM ADDED */
INSERT INTO access_rank(access_type, rank) VALUES ('public',1000),('team',2000),('owner',3000)  ON CONFLICT DO NOTHING;

CREATE TABLE "item" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7_sub_ms() NOT NULL,
	"parent_id" uuid,
	"space_id" uuid NOT NULL,
	"created_by" uuid NOT NULL,
	"name" varchar(256) NOT NULL,
	"mime_type" varchar(255),
	"size_byte" bigint,
	"item_type" "item_type" GENERATED ALWAYS AS (CASE WHEN mime_type IS NULL 
                   THEN 'folder'::item_type 
                   ELSE 'file'::item_type 
              END) STORED,
	"trashed_delete_dt" timestamp with time zone,
	"access_type" "access_type" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chk_item_semantics" CHECK (
      (
        ("item"."item_type" = 'file' AND "item"."mime_type" IS NOT NULL AND "item"."size_byte" IS NOT NULL)
        OR
        ("item"."item_type" = 'folder' AND "item"."mime_type" IS NULL AND "item"."size_byte" IS NULL)
      )
    ),
	CONSTRAINT "chk_item_not_self_parent" CHECK ("item"."parent_id" IS NULL OR "item"."parent_id" <> "item"."id"),
	CONSTRAINT "chk_size_non_negative" CHECK ("item"."size_byte" IS NULL OR "item"."size_byte" >= 0::bigint),
	CONSTRAINT "chk_item_name_not_empty" CHECK ("item"."name" <> ''),
	CONSTRAINT "chk_valid_delete_dt" CHECK ("item"."trashed_delete_dt" IS NULL OR "item"."trashed_delete_dt" > "item"."created_at")
);
--> statement-breakpoint
CREATE TABLE "space" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7_sub_ms() NOT NULL,
	"name" varchar(256) NOT NULL,
	"type" "space_type" NOT NULL,
	"created_by" uuid NOT NULL,
	"owned_by" uuid NOT NULL,
	"access_type" "access_type" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_space_owner_name" UNIQUE("owned_by","name"),
	CONSTRAINT "uq_space_team_name" UNIQUE("type","name")
);
--> statement-breakpoint
ALTER TABLE "account" ALTER COLUMN "id" SET DATA TYPE uuid;--> statement-breakpoint
ALTER TABLE "session" ALTER COLUMN "id" SET DATA TYPE uuid;--> statement-breakpoint
ALTER TABLE "user" ALTER COLUMN "id" SET DATA TYPE uuid;--> statement-breakpoint
ALTER TABLE "verification" ALTER COLUMN "id" SET DATA TYPE uuid;--> statement-breakpoint
ALTER TABLE "item" ADD CONSTRAINT "item_parent_id_item_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."item"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item" ADD CONSTRAINT "item_space_id_space_id_fk" FOREIGN KEY ("space_id") REFERENCES "public"."space"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item" ADD CONSTRAINT "item_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "space" ADD CONSTRAINT "space_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "space" ADD CONSTRAINT "space_owned_by_user_id_fk" FOREIGN KEY ("owned_by") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_item_space" ON "item" USING btree ("space_id");--> statement-breakpoint
CREATE INDEX "idx_item_parent" ON "item" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "idx_item_trash_time" ON "item" USING btree ("trashed_delete_dt");--> statement-breakpoint
CREATE INDEX "idx_item_created_by" ON "item" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "idx_item_space_parent_created" ON "item" USING btree ("space_id","parent_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_item_space_parent" ON "item" USING btree ("space_id","parent_id");--> statement-breakpoint
CREATE INDEX "idx_item_space_not_trashed" ON "item" USING btree ("space_id") WHERE "item"."trashed_delete_dt" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_item_space_trashed" ON "item" USING btree ("space_id") WHERE "item"."trashed_delete_dt" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "idx_item_parent_live_name" ON "item" USING btree ("parent_id","name") WHERE "item"."trashed_delete_dt" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_item_parent_trash_name" ON "item" USING btree ("parent_id","name") WHERE "item"."trashed_delete_dt" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "idx_item_expire" ON "item" USING btree ("trashed_delete_dt") WHERE "item"."trashed_delete_dt" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_sibling_live" ON "item" USING btree ("space_id","parent_id","name") WHERE "item"."trashed_delete_dt" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_root_live" ON "item" USING btree ("space_id","name") WHERE "item"."parent_id" IS NULL AND "item"."trashed_delete_dt" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_space_created_by" ON "space" USING btree ("created_by");--> statement-breakpoint
CREATE MATERIALIZED VIEW public.item_with_effective_access AS
WITH RECURSIVE chain AS (
  SELECT
    i.id,
    i.space_id,
    i.parent_id,
    i.access_type,
    ar.rank
  FROM item i
  JOIN access_rank ar
    ON ar.access_type = i.access_type

  UNION ALL

  SELECT
    c.id,
    p.space_id,
    p.parent_id,
    p.access_type,
    ar.rank
  FROM chain c
  JOIN item p
    ON p.id = c.parent_id
  JOIN access_rank ar
    ON ar.access_type = p.access_type
),
ranked AS (
  SELECT
    id,
    space_id,
    access_type,
    rank,
    ROW_NUMBER() OVER (PARTITION BY id, space_id ORDER BY rank DESC) AS rn
  FROM chain
)
SELECT
  id,
  space_id,
  rank        AS effective_rank,
  access_type AS effective_access
FROM ranked
WHERE rn = 1;