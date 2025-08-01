-- Custom SQL migration file, put your code below! --
/* https://github.com/drizzle-team/drizzle-orm/issues/860#issuecomment-2544465387 */

COMMIT;--> statement-breakpoint
CREATE UNIQUE INDEX CONCURRENTLY "mv_item_pk"
  ON "item_with_effective_access" ("id", "space_id");