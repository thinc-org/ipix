-- Custom SQL migration file, put your code below! --

CREATE OR REPLACE FUNCTION normalize_file_state_for_folders()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.item_type = 'folder' THEN
    NEW.file_state := NULL;
  ELSIF NEW.file_state IS NULL THEN
    NEW.file_state := 'placeholder';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS normalize_file_state_for_folders_biu ON item;
CREATE TRIGGER normalize_file_state_for_folders_biu
BEFORE INSERT OR UPDATE OF item_type, file_state ON item
FOR EACH ROW
EXECUTE FUNCTION normalize_file_state_for_folders();

CREATE OR REPLACE FUNCTION check_parent_is_folder() RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.parent_id IS NOT NULL THEN
    PERFORM 1
    FROM   item p
    WHERE  p.id = NEW.parent_id
      AND  p.item_type = 'folder';
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Parent item (%) is not a folder', NEW.parent_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE CONSTRAINT TRIGGER chk_parent_is_folder
AFTER INSERT OR UPDATE ON item
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION check_parent_is_folder();

CREATE OR REPLACE FUNCTION check_item_cycle()
RETURNS TRIGGER
LANGUAGE plpgsql AS $$
DECLARE
  cur uuid;
BEGIN
  IF NEW.parent_id IS NULL THEN
    RETURN NEW;
  END IF;

  cur := NEW.parent_id;
  WHILE cur IS NOT NULL LOOP
    IF cur = NEW.id THEN
      RAISE EXCEPTION
        USING ERRCODE = '23514',
              MESSAGE  = format(
                 'Cycle detected: "%s" would become its own ancestor',
                 NEW.id);
    END IF;
    SELECT parent_id INTO cur
    FROM   item WHERE id = cur;
  END LOOP;

  RETURN NEW;
END;
$$;

CREATE CONSTRAINT TRIGGER chk_item_no_cycle
AFTER INSERT OR UPDATE OF parent_id ON item
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION check_item_cycle();

CREATE OR REPLACE FUNCTION check_parent_same_space()
RETURNS TRIGGER
LANGUAGE plpgsql AS $$
DECLARE
  parent_space uuid;
BEGIN
  IF NEW.parent_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT space_id INTO parent_space
  FROM   item
  WHERE  id = NEW.parent_id;

  IF parent_space IS NULL OR parent_space <> NEW.space_id THEN
    RAISE EXCEPTION
      USING ERRCODE = '23514',
            MESSAGE  = 'Parent and child must belong to the same space';
  END IF;

  RETURN NEW;
END;
$$;

CREATE CONSTRAINT TRIGGER chk_parent_same_space
AFTER INSERT OR UPDATE OF parent_id, space_id ON item
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION check_parent_same_space();

CREATE OR REPLACE FUNCTION check_space_root_folder()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE it item%ROWTYPE;
BEGIN
  SELECT * INTO it FROM item WHERE id = NEW.root_folder_id;
  IF it.parent_id IS NOT NULL THEN
    RAISE EXCEPTION 'root_folder_id must reference an item with parent_id IS NULL';
  END IF;
  IF it.item_type <> 'folder' THEN
    RAISE EXCEPTION 'root_folder_id must reference a folder';
  END IF;
  IF it.space_id <> NEW.id THEN
    RAISE EXCEPTION 'root_folder_id must reference an item in the same space';
  END IF;
  RETURN NEW;
END $$;

CREATE CONSTRAINT TRIGGER chk_space_root_folder
AFTER INSERT OR UPDATE OF root_folder_id ON space
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION check_space_root_folder();

CREATE OR REPLACE FUNCTION chk_no_team_in_personal()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE st space.ownership_type%TYPE;
BEGIN
  SELECT ownership_type INTO st FROM space WHERE id = NEW.space_id;
  IF st = 'personal' AND NEW.access_type = 'team' THEN
    RAISE EXCEPTION 'team access not allowed in personal spaces';
  END IF;
  RETURN NEW;
END $$;

CREATE CONSTRAINT TRIGGER chk_team_access_personal
AFTER INSERT OR UPDATE OF access_type, space_id ON item
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION chk_no_team_in_personal();

CREATE OR REPLACE FUNCTION set_trash_subtree(_root uuid, _trashed_at timestamptz, _purge_at timestamptz DEFAULT NULL)
RETURNS void LANGUAGE sql AS $$
  WITH RECURSIVE sub AS (
    SELECT id FROM item WHERE id = _root
    UNION ALL
    SELECT i.id FROM item i JOIN sub s ON i.parent_id = s.id
  )
  UPDATE item i
  SET trashed_at = _trashed_at,
      purge_at   = CASE WHEN _trashed_at IS NULL THEN NULL ELSE _purge_at END
  FROM sub
  WHERE i.id = sub.id;
$$;