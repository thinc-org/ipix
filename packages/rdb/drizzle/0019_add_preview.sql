-- Custom SQL migration file, put your code below! --

-- 1) Enum
DO $$ BEGIN
  CREATE TYPE blob_loc_kind AS ENUM ('canon', 'preview');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2) Columns
ALTER TABLE file_blob_location
  ADD COLUMN IF NOT EXISTS kind blob_loc_kind NOT NULL DEFAULT 'canon',
  ADD COLUMN IF NOT EXISTS item_id uuid,
  ADD COLUMN IF NOT EXISTS variant citext,
  ADD COLUMN IF NOT EXISTS algo_v smallint,
  ADD COLUMN IF NOT EXISTS ext text;

-- 3) FK
ALTER TABLE file_blob_location
  DROP CONSTRAINT IF EXISTS fbl_item_fk;
ALTER TABLE file_blob_location
  ADD CONSTRAINT fbl_item_fk
  FOREIGN KEY (item_id) REFERENCES item(id) ON DELETE CASCADE;

-- 4) Checks
ALTER TABLE file_blob_location
  DROP CONSTRAINT IF EXISTS chk_fbl_kind_columns,
  ADD CONSTRAINT chk_fbl_kind_columns
  CHECK (
    (kind = 'canon' AND item_id IS NULL AND variant IS NULL AND algo_v IS NULL AND ext IS NULL)
    OR
    (kind = 'preview' AND item_id IS NOT NULL AND variant IS NOT NULL AND algo_v IS NOT NULL)
  );

ALTER TABLE file_blob_location
  DROP CONSTRAINT IF EXISTS chk_fbl_primary_only_canon,
  ADD CONSTRAINT chk_fbl_primary_only_canon
  CHECK ((kind = 'canon') OR (kind = 'preview' AND is_primary = false));

-- 5) Logical uniqueness for previews
DROP INDEX IF EXISTS uq_preview_identity;
CREATE UNIQUE INDEX uq_preview_identity
  ON file_blob_location(asset_id, item_id, variant, algo_v, COALESCE(ext, ''))
  WHERE kind = 'preview';

-- 6) Helper: derive sha24 (text) from asset
CREATE OR REPLACE FUNCTION asset_sha24(_asset uuid)
RETURNS text
LANGUAGE sql STABLE STRICT AS $$
  SELECT substring(encode(sha256, 'hex') for 24)
  FROM file_asset
  WHERE id = _asset
$$;

-- 7) Build preview key
CREATE OR REPLACE FUNCTION build_preview_key(
  _space uuid, _item uuid, _sha24 text, _variant citext, _algov smallint, _ext text
) RETURNS text
LANGUAGE plpgsql IMMUTABLE STRICT AS $$
DECLARE
  e text := CASE WHEN _ext IS NULL OR btrim(_ext) = '' THEN '' ELSE '.' || lower(_ext) END;
BEGIN
  RETURN format(
    'spaces/%s/%s/%s/previews/%s@v%s%s',
    _space, _item, lower(_sha24), lower(_variant), _algov, e
  );
END $$;

-- 8) Trigger to compute preview object_key and normalize bucket
CREATE OR REPLACE FUNCTION fbl_enforce_preview_key()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  s uuid;
  sha24 text;
BEGIN
  -- Normalize bucket always
  NEW.bucket := lower(NEW.bucket);

  IF NEW.kind = 'preview' THEN
    IF NEW.item_id IS NULL THEN
      RAISE EXCEPTION 'preview locations require item_id';
    END IF;

    SELECT space_id INTO s FROM item WHERE id = NEW.item_id;
    IF s IS NULL THEN
      RAISE EXCEPTION 'item % not found', NEW.item_id;
    END IF;

    sha24 := asset_sha24(NEW.asset_id);
    IF sha24 IS NULL THEN
      RAISE EXCEPTION 'asset % not found', NEW.asset_id;
    END IF;

    NEW.object_key := build_preview_key(s, NEW.item_id, sha24, NEW.variant, NEW.algo_v, NEW.ext);
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS fbl_enforce_preview_key_biu ON file_blob_location;
CREATE TRIGGER fbl_enforce_preview_key_biu
BEFORE INSERT OR UPDATE OF kind, item_id, variant, algo_v, ext, asset_id, bucket
ON file_blob_location
FOR EACH ROW EXECUTE FUNCTION fbl_enforce_preview_key();

-- 9) Convenience function to upsert a preview and return id + key
CREATE OR REPLACE FUNCTION upsert_preview_location(
  _asset uuid,
  _item uuid,
  _provider blob_provider,
  _region text,
  _bucket citext,
  _variant citext,
  _algo_v smallint,
  _version_id text DEFAULT NULL,
  _ext text DEFAULT NULL,
  _storage_class blob_storage_class DEFAULT NULL,
  _etag text DEFAULT NULL
) RETURNS TABLE (id uuid, object_key text)
LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO file_blob_location (
    asset_id, item_id, kind,
    provider, region, bucket, version_id,
    variant, algo_v, ext,
    is_primary, state, storage_class, etag
  )
  VALUES (
    _asset, _item, 'preview',
    _provider, _region, lower(_bucket), _version_id,
    lower(_variant), _algo_v, _ext,
    false, 'active', _storage_class, _etag
  )
  ON CONFLICT DO NOTHING;

  RETURN QUERY
  SELECT id, object_key
  FROM file_blob_location
  WHERE asset_id = _asset
    AND item_id = _item
    AND kind = 'preview'
    AND variant = lower(_variant)
    AND algo_v = _algo_v
    AND COALESCE(ext, '') = COALESCE(_ext, '');
END $$;
