-- Custom SQL migration file, put your code below! --

ALTER TABLE "file_asset"
  ADD CONSTRAINT "chk_asset_content_type_valid" CHECK (
    "file_asset"."content_type" ~* '^[A-Za-z0-9][A-Za-z0-9!#$&^_.+-]*/[A-Za-z0-9][A-Za-z0-9!#$&^_.+-]*(?:;\s*[A-Za-z0-9!#$&^_.+-]+=(?:"[^"]*"|[A-Za-z0-9!#$&^_.+-]+))*$'
  );

ALTER TABLE "item"
  ADD CONSTRAINT "chk_item_name_valid" CHECK (
    "item"."name" !~ '[[:cntrl:]/\\:*?"<>|]'
    AND "item"."name" NOT IN ('.', '..')
    AND btrim("item"."name", ' .') = "item"."name"
    AND "item"."name" !~* '^(con|prn|aux|nul|com[1-9]|lpt[1-9])(..*)?$'
    AND char_length("item"."name") BETWEEN 1 AND 255
  );

ALTER TABLE "item"
  ADD CONSTRAINT "chk_mime_type_valid" CHECK (
    ("item"."mime_type" IS NULL OR "item"."mime_type" ~* '^[A-Za-z0-9][A-Za-z0-9!#$&^_.+-]*/[A-Za-z0-9][A-Za-z0-9!#$&^_.+-]*(?:;\s*[A-Za-z0-9!#$&^_.+-]+=(?:"[^"]*"|[A-Za-z0-9!#$&^_.+-]+))*$')
  );

ALTER TABLE "space"
  ADD CONSTRAINT "chk_space_name_len" CHECK (
    char_length("space"."name") BETWEEN 1 AND 255
  );

ALTER TABLE "upload_session"
  ADD CONSTRAINT "chk_content_type_valid" CHECK (
    ("upload_session"."content_type" IS NULL OR "upload_session"."content_type" ~* '^[A-Za-z0-9][A-Za-z0-9!#$&^_.+-]*/[A-Za-z0-9][A-Za-z0-9!#$&^_.+-]*(?:;\s*[A-Za-z0-9!#$&^_.+-]+=(?:"[^"]*"|[A-Za-z0-9!#$&^_.+-]+))*$')
  );

ALTER TABLE item
  ALTER CONSTRAINT item_parent_id_fk
  DEFERRABLE INITIALLY DEFERRED;

ALTER TABLE item
  ADD CONSTRAINT uq_sibling_live_ci
  UNIQUE (space_id, parent_id, live_name)
  DEFERRABLE INITIALLY DEFERRED;

ALTER TABLE item
  ALTER CONSTRAINT item_access_type_fk
  DEFERRABLE INITIALLY DEFERRED;

ALTER TABLE space
  ALTER CONSTRAINT space_root_folder_id_fkey
  DEFERRABLE INITIALLY DEFERRED;