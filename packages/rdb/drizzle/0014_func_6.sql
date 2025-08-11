-- Custom SQL migration file, put your code below! --

CREATE OR REPLACE FUNCTION chk_upload_targets_file()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE it RECORD;
BEGIN
  SELECT item_type, trashed_at INTO it FROM item WHERE id = NEW.item_id;
  IF it.item_type <> 'file' THEN
    RAISE EXCEPTION 'upload_session must target a file';
  END IF;
  IF it.trashed_at IS NOT NULL THEN
    RAISE EXCEPTION 'cannot upload to a trashed item';
  END IF;
  RETURN NEW;
END $$;

CREATE CONSTRAINT TRIGGER chk_upload_targets_file
AFTER INSERT OR UPDATE OF item_id ON upload_session
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION chk_upload_targets_file();

CREATE OR REPLACE FUNCTION chk_item_asset_consistency()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE a RECORD;
BEGIN
  -- If an asset is set, the item must be a ready file and its local cache must match the asset.
  IF NEW.asset_id IS NOT NULL THEN
    IF NEW.item_type <> 'file' THEN
      RAISE EXCEPTION 'asset_id may only be set for item_type=file';
    END IF;
    IF NEW.file_state <> 'ready' THEN
      RAISE EXCEPTION 'asset_id requires file_state=ready';
    END IF;

    SELECT size_byte, content_type INTO a
    FROM file_asset WHERE id = NEW.asset_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'asset_id does not reference an existing file_asset';
    END IF;

    IF NEW.size_byte IS NULL OR NEW.mime_type IS NULL THEN
      RAISE EXCEPTION 'ready file must have size_byte and mime_type set';
    END IF;

    IF NEW.size_byte <> a.size_byte OR NEW.mime_type <> a.content_type THEN
      RAISE EXCEPTION 'item size/mime mismatch with file_asset';
    END IF;
  ELSE
    -- No asset: cannot be ready
    IF NEW.file_state = 'ready' THEN
      RAISE EXCEPTION 'ready file must reference a file_asset';
    END IF;
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS chk_item_asset_consistency_row ON item;
CREATE CONSTRAINT TRIGGER chk_item_asset_consistency_row
AFTER INSERT OR UPDATE OF asset_id, file_state, size_byte, mime_type, item_type ON item
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION chk_item_asset_consistency();

CREATE OR REPLACE FUNCTION canonical_blob_key(_sha256 bytea)
RETURNS text
LANGUAGE sql IMMUTABLE STRICT AS $$
  SELECT format(
    'blobs/sha256/%s/%s/%s',
    substring(encode(_sha256,'hex') for 2),
    substring(encode(_sha256,'hex') from 3 for 2),
    encode(_sha256,'hex')
  );
$$;

CREATE OR REPLACE FUNCTION asset_has_primary(_asset uuid)
RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM file_blob_location
    WHERE asset_id = _asset AND is_primary = true
  );
$$;

CREATE OR REPLACE FUNCTION set_primary_location(_asset uuid, _location uuid)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(_asset::text, 0));
  UPDATE file_blob_location
  SET is_primary = false
  WHERE asset_id = _asset AND is_primary = true AND id <> _location;

  UPDATE file_blob_location
  SET is_primary = true
  WHERE id = _location AND asset_id = _asset;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Location % does not belong to asset %', _location, _asset;
  END IF;
END $$;