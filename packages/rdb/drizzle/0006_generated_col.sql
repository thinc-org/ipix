-- Custom SQL migration file, put your code below! --

ALTER TABLE item
  ADD COLUMN live_name citext
  GENERATED ALWAYS AS (CASE WHEN trashed_at IS NULL THEN name ELSE NULL END) STORED;