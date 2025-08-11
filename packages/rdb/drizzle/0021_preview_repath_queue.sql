-- Custom SQL migration file, put your code below! --

CREATE TABLE IF NOT EXISTS preview_repath_queue (
  id uuid PRIMARY KEY DEFAULT uuidv7_sub_ms(),
  fbl_id uuid NOT NULL REFERENCES file_blob_location(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES item(id) ON DELETE CASCADE,
  asset_id uuid NOT NULL REFERENCES file_asset(id) ON DELETE CASCADE,
  from_space uuid NOT NULL REFERENCES space(id) ON DELETE CASCADE,
  to_space uuid NOT NULL REFERENCES space(id) ON DELETE CASCADE,

  provider blob_provider NOT NULL,
  region text,
  bucket citext NOT NULL,

  old_key text NOT NULL,
  new_key text NOT NULL,

  variant citext NOT NULL,
  algo_v smallint NOT NULL,
  ext text,

  enqueued_at timestamptz NOT NULL DEFAULT now(),
  attempts integer NOT NULL DEFAULT 0,
  processed_at timestamptz,
  error text
);

-- Prevent duplicate tasks per preview for a given destination space
CREATE UNIQUE INDEX IF NOT EXISTS uq_prq_fbl_to_space
  ON preview_repath_queue(fbl_id, to_space);