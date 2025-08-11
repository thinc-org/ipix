-- Custom SQL migration file, put your code below! --

CREATE OR REPLACE FUNCTION iea_mark_dirty()
RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO item_effective_recalc_queue(txid, id)
  VALUES (txid_current(), NEW.id)
  ON CONFLICT DO NOTHING;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS iea_mark_dirty_row ON item;
CREATE CONSTRAINT TRIGGER iea_mark_dirty_row
AFTER INSERT OR UPDATE OF access_type, parent_id, trashed_at, space_id ON item
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION iea_mark_dirty();

CREATE OR REPLACE FUNCTION iea_mark_dirty_on_rank()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO item_effective_recalc_queue(txid, id)
  SELECT txid_current(), i.id
  FROM item i
  WHERE i.access_type = COALESCE(NEW.access_type, OLD.access_type)
  ON CONFLICT DO NOTHING;
  RETURN NULL;
END $$;

CREATE TRIGGER iea_dirty_on_rank
AFTER INSERT OR UPDATE OR DELETE ON access_rank
FOR EACH STATEMENT
EXECUTE FUNCTION iea_mark_dirty_on_rank();

