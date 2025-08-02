ALTER TABLE "access_rank" DROP CONSTRAINT "chk_rank_matches_enum";--> statement-breakpoint
ALTER TABLE "item" ADD COLUMN "preview_id" uuid DEFAULT uuidv7_sub_ms() NOT NULL;--> statement-breakpoint
ALTER TABLE "access_rank" ADD CONSTRAINT "chk_rank_matches_enum" CHECK (
       ("access_rank"."access_type" = 'public' AND "access_rank"."rank" = 1000)
    OR ("access_rank"."access_type" = 'team'   AND "access_rank"."rank" = 2000)
    OR ("access_rank"."access_type" = 'owner'  AND "access_rank"."rank" = 3000)
    );