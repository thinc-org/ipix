-- Custom SQL migration file, put your code below! --

COMMIT;--> statement-breakpoint
REFRESH MATERIALIZED VIEW CONCURRENTLY public.item_with_effective_access;