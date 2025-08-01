-- Custom SQL migration file, put your code below! --

ALTER TABLE item
  ALTER CONSTRAINT item_parent_id_item_id_fk
  DEFERRABLE INITIALLY DEFERRED;

CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = CURRENT_TIMESTAMP;
   RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_timestamp ON item;
CREATE TRIGGER set_timestamp
BEFORE UPDATE ON item
FOR EACH ROW
EXECUTE FUNCTION update_timestamp();

DROP TRIGGER IF EXISTS set_timestamp ON "space";
CREATE TRIGGER set_timestamp
BEFORE UPDATE ON "space"
FOR EACH ROW
EXECUTE FUNCTION update_timestamp();