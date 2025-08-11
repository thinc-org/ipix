-- Custom SQL migration file, put your code below! --

CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = now();
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

DROP TRIGGER IF EXISTS set_timestamp ON "upload_session";
CREATE TRIGGER set_timestamp
BEFORE UPDATE ON "upload_session"
FOR EACH ROW
EXECUTE FUNCTION update_timestamp();

CREATE OR REPLACE FUNCTION forbid_created_at_update()
RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'created_at is immutable and cannot be modified';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS forbid_created_at_update_item ON item;
CREATE TRIGGER forbid_created_at_update_item
BEFORE UPDATE OF created_at ON item
FOR EACH ROW
EXECUTE FUNCTION forbid_created_at_update();

DROP TRIGGER IF EXISTS forbid_created_at_update_space ON "space";
CREATE TRIGGER forbid_created_at_update_space
BEFORE UPDATE OF created_at ON "space"
FOR EACH ROW
EXECUTE FUNCTION forbid_created_at_update();

DROP TRIGGER IF EXISTS forbid_created_at_update_upload_session ON upload_session;
CREATE TRIGGER forbid_created_at_update_upload_session
BEFORE UPDATE OF created_at ON upload_session
FOR EACH ROW
EXECUTE FUNCTION forbid_created_at_update();