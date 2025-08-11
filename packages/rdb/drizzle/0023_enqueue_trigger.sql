-- Custom SQL migration file, put your code below! --

CREATE OR REPLACE FUNCTION enqueue_preview_repath_on_move()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  allow text := current_setting('app.allow_space_move_preview_repath', true);
  sha24 text;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.space_id IS DISTINCT FROM OLD.space_id THEN
    IF coalesce(allow, 'off') = 'on' THEN
      -- Insert tasks for each preview belonging to this item
      FOR sha24 IN SELECT asset_sha24(NEW.asset_id) LOOP
        INSERT INTO preview_repath_queue (
          fbl_id, item_id, asset_id,
          from_space, to_space,
          provider, region, bucket,
          old_key, new_key,
          variant, algo_v, ext
        )
        SELECT
          fbl.id, fbl.item_id, fbl.asset_id,
          OLD.space_id, NEW.space_id,
          fbl.provider, fbl.region, fbl.bucket,
          fbl.object_key,
          build_preview_key(
            NEW.space_id, fbl.item_id, sha24, fbl.variant, fbl.algo_v, fbl.ext
          ),
          fbl.variant, fbl.algo_v, fbl.ext
        FROM file_blob_location fbl
        WHERE fbl.kind = 'preview' AND fbl.item_id = NEW.id
        ON CONFLICT ON CONSTRAINT uq_prq_fbl_to_space DO NOTHING;
      END LOOP;
    END IF;
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS enqueue_preview_repath_on_move_deferred ON item;
CREATE CONSTRAINT TRIGGER enqueue_preview_repath_on_move_deferred
AFTER UPDATE OF space_id ON item
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION enqueue_preview_repath_on_move();
