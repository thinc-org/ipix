-- Custom SQL migration file, put your code below! --

CREATE OR REPLACE FUNCTION finalize_upload_with_asset_and_location(
  _item uuid,
  _session uuid,
  _sha256 bytea,
  _content_type citext,
  _size bigint,
  _provider blob_provider,
  _region text,
  _bucket citext,
  _version_id text DEFAULT NULL,
  _etag text DEFAULT NULL,
  _storage_class blob_storage_class DEFAULT NULL,
  _set_primary boolean DEFAULT true
) RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  s upload_session%ROWTYPE;
  a_id uuid;
  canon_key text;
  loc_id uuid;
  will_make_primary boolean;
BEGIN
  -- Validate session and item
  SELECT * INTO s
  FROM upload_session
  WHERE key = _session AND item_id = _item
  FOR UPDATE;

  IF NOT FOUND OR s.status <> 'in_progress' THEN
    RAISE EXCEPTION 'Invalid session';
  END IF;

  PERFORM 1 FROM item WHERE id = _item FOR UPDATE;

  IF s.expected_size IS NOT NULL AND s.expected_size <> _size THEN
    RAISE EXCEPTION 'Size mismatch: expected %, got %', s.expected_size, _size;
  END IF;

  -- Insert or reuse file_asset
  WITH ins AS (
    INSERT INTO file_asset (sha256, size_byte, content_type)
    VALUES (_sha256, _size, COALESCE(_content_type, s.content_type))
    ON CONFLICT (sha256) DO NOTHING
    RETURNING id
  )
  SELECT id INTO a_id FROM ins
  UNION ALL
  SELECT id FROM file_asset WHERE sha256 = _sha256
  LIMIT 1;

  -- Canonical key for physical storage
  canon_key := canonical_blob_key(_sha256);

  -- Serialize per-asset mutations to avoid race on primaries
  PERFORM pg_advisory_xact_lock(hashtextextended(a_id::text, 0));

  -- Decide if we should make this location primary:
  -- only if caller asked, and none exists yet.
  will_make_primary := _set_primary AND NOT asset_has_primary(a_id);

  -- Try inserting the location (prefer canonical key)
  INSERT INTO file_blob_location (
    asset_id, provider, region, bucket, object_key, version_id,
    is_primary, state, storage_class, etag
  )
  VALUES (
    a_id, _provider, _region, lower(_bucket), canon_key, _version_id,
    will_make_primary, 'active', _storage_class, _etag
  )
  ON CONFLICT DO NOTHING
  RETURNING id INTO loc_id;

  IF loc_id IS NULL THEN
    SELECT id INTO loc_id
    FROM file_blob_location
    WHERE provider = _provider
      AND (region IS NOT DISTINCT FROM _region)
      AND bucket = lower(_bucket)
      AND object_key = canon_key
      AND (version_id IS NOT DISTINCT FROM _version_id)
    LIMIT 1;
  END IF;

  -- Update metadata (idempotent) and optionally promote to primary if none exists.
  UPDATE file_blob_location
  SET
    state = 'active',
    storage_class = COALESCE(_storage_class, storage_class),
    etag = COALESCE(_etag, etag),
    is_primary = CASE WHEN will_make_primary THEN true ELSE is_primary END
  WHERE id = loc_id;

  -- Finish the item link (same as your current finalize)
  UPDATE item
  SET mime_type = lower(COALESCE(mime_type, COALESCE(_content_type, s.content_type))),
      size_byte = _size,
      file_state = 'ready',
      asset_id = a_id
  WHERE id = _item
    AND file_state <> 'ready';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Item already finalized';
  END IF;

  UPDATE upload_session
  SET status = 'completed', completed_at = now()
  WHERE key = _session;
END $$;