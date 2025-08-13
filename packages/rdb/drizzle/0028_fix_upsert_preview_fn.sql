-- Custom SQL migration file, put your code below! --

-- Fix ambiguous column references in upsert_preview_location RETURN QUERY
-- Qualify selected columns to avoid ambiguity with OUT params

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
  SELECT fbl.id, fbl.object_key
  FROM file_blob_location AS fbl
  WHERE fbl.asset_id = _asset
    AND fbl.item_id = _item
    AND fbl.kind = 'preview'
    AND fbl.variant = lower(_variant)
    AND fbl.algo_v = _algo_v
    AND COALESCE(fbl.ext, '') = COALESCE(_ext, '');
END $$;
