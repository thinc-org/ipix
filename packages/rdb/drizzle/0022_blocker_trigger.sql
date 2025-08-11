-- Custom SQL migration file, put your code below! --

-- Session flag name: app.allow_space_move_preview_repath = 'on'
CREATE OR REPLACE FUNCTION chk_block_space_move_when_previews()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  has_prev boolean;
  allow text := current_setting('app.allow_space_move_preview_repath', true);
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.space_id IS DISTINCT FROM OLD.space_id THEN
    SELECT EXISTS (
      SELECT 1 FROM file_blob_location
      WHERE kind = 'preview' AND item_id = NEW.id
    ) INTO has_prev;

    IF has_prev AND coalesce(allow, 'off') <> 'on' THEN
      RAISE EXCEPTION 'Cannot move item % across spaces while previews exist (enable app.allow_space_move_preview_repath to proceed)', NEW.id;
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS chk_block_space_move_when_previews_deferred ON item;
CREATE CONSTRAINT TRIGGER chk_block_space_move_when_previews_deferred
AFTER UPDATE OF space_id ON item
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION chk_block_space_move_when_previews();