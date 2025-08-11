-- Custom SQL migration file, put your code below! --

CREATE OR REPLACE FUNCTION list_preview_repath_tasks(_limit int DEFAULT 100)
RETURNS TABLE (
  id uuid, fbl_id uuid, item_id uuid, asset_id uuid,
  from_space uuid, to_space uuid,
  provider blob_provider, region text, bucket citext,
  old_key text, new_key text,
  variant citext, algo_v smallint, ext text,
  enqueued_at timestamptz, attempts integer
) LANGUAGE sql STABLE AS $$
  SELECT id, fbl_id, item_id, asset_id,
         from_space, to_space,
         provider, region, bucket,
         old_key, new_key,
         variant, algo_v, ext,
         enqueued_at, attempts
  FROM preview_repath_queue
  WHERE processed_at IS NULL
  ORDER BY enqueued_at
  LIMIT COALESCE(_limit, 100)
$$;

CREATE OR REPLACE FUNCTION mark_preview_repath_done(
  _task uuid,
  _version_id text DEFAULT NULL,
  _etag text DEFAULT NULL
) RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  t preview_repath_queue%ROWTYPE;
BEGIN
  SELECT * INTO t FROM preview_repath_queue WHERE id = _task FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Task % not found', _task;
  END IF;

  -- Update the file_blob_location to point to the new_key
  UPDATE file_blob_location
  SET object_key = t.new_key,
      version_id = COALESCE(_version_id, version_id),
      etag = COALESCE(_etag, etag),
      updated_at = now()
  WHERE id = t.fbl_id;

  UPDATE preview_repath_queue
  SET processed_at = now()
  WHERE id = _task;
END $$;

CREATE OR REPLACE FUNCTION mark_preview_repath_failed(_task uuid, _error text)
RETURNS void LANGUAGE sql AS $$
  UPDATE preview_repath_queue
  SET attempts = attempts + 1,
      error = _error
  WHERE id = _task
$$;
