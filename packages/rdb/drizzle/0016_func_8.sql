-- Custom SQL migration file, put your code below! --

CREATE OR REPLACE FUNCTION chk_upload_item_id_immutable()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.item_id <> OLD.item_id THEN
    RAISE EXCEPTION 'item_id is immutable for an upload_session';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER chk_upload_item_id_immutable
BEFORE UPDATE OF item_id ON upload_session
FOR EACH ROW EXECUTE FUNCTION chk_upload_item_id_immutable();

CREATE OR REPLACE FUNCTION chk_item_asset_id_immutable()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.asset_id IS NOT NULL AND NEW.asset_id IS DISTINCT FROM OLD.asset_id THEN
    RAISE EXCEPTION 'asset_id is immutable once set';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER chk_item_asset_id_immutable
BEFORE UPDATE OF asset_id ON item
FOR EACH ROW EXECUTE FUNCTION chk_item_asset_id_immutable();

CREATE OR REPLACE FUNCTION chk_file_asset_immutable()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.sha256 IS DISTINCT FROM OLD.sha256
       OR NEW.size_byte IS DISTINCT FROM OLD.size_byte
       OR NEW.content_type IS DISTINCT FROM OLD.content_type
       OR NEW.width_px IS DISTINCT FROM OLD.width_px
       OR NEW.height_px IS DISTINCT FROM OLD.height_px THEN
      RAISE EXCEPTION 'file_asset core properties are immutable';
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS chk_file_asset_immutable_bu ON file_asset;
CREATE TRIGGER chk_file_asset_immutable_bu
BEFORE UPDATE ON file_asset
FOR EACH ROW EXECUTE FUNCTION chk_file_asset_immutable();

CREATE OR REPLACE FUNCTION chk_expected_size_immutable()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'UPDATE'
     AND NEW.expected_size <> OLD.expected_size
     AND (OLD.status IN ('in_progress','completed') OR NEW.status IN ('in_progress','completed')) THEN
    RAISE EXCEPTION 'expected_size cannot change after upload starts';
  END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;

CREATE TRIGGER chk_expected_size_immutable
BEFORE UPDATE OF expected_size, status ON upload_session
FOR EACH ROW EXECUTE FUNCTION chk_expected_size_immutable();

CREATE OR REPLACE FUNCTION chk_upload_status_transition()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status NOT IN ('initiated', 'in_progress') THEN
      RAISE EXCEPTION 'Invalid initial status %', NEW.status;
    END IF;

    IF NEW.status = 'completed' AND NEW.completed_at IS NULL THEN
      RAISE EXCEPTION 'completed_at required on completion';
    END IF;

  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.status = 'initiated'
       AND NEW.status NOT IN ('initiated', 'in_progress', 'aborted', 'failed') THEN
      RAISE EXCEPTION 'Invalid transition % -> %', OLD.status, NEW.status;
    ELSIF OLD.status = 'in_progress'
       AND NEW.status NOT IN ('in_progress', 'completed', 'aborted', 'failed') THEN
      RAISE EXCEPTION 'Invalid transition % -> %', OLD.status, NEW.status;
    ELSIF OLD.status = 'completed' AND NEW.status <> 'completed' THEN
      RAISE EXCEPTION 'Cannot un-complete a session';
    END IF;

    IF NEW.status = 'completed' AND NEW.completed_at IS NULL THEN
      RAISE EXCEPTION 'completed_at required on completion';
    END IF;

  ELSE
    RAISE EXCEPTION 'Unexpected trigger operation: %', TG_OP;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER chk_upload_status_transition
BEFORE INSERT OR UPDATE OF status, completed_at ON upload_session
FOR EACH ROW
EXECUTE FUNCTION chk_upload_status_transition();