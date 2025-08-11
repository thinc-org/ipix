-- Custom SQL migration file, put your code below! --

CREATE OR REPLACE FUNCTION chk_access_not_stricter_than_ancestors()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE parent_rank smallint;
        new_rank smallint;
BEGIN
  IF NEW.parent_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT ar.rank INTO new_rank FROM access_rank ar WHERE ar.access_type = NEW.access_type;

  -- Walk up to find the minimum ancestor rank (i.e., least restrictive)
  WITH RECURSIVE chain AS (
    SELECT p.id, p.parent_id, ar.rank
    FROM item p
    JOIN access_rank ar ON ar.access_type = p.access_type
    WHERE p.id = NEW.parent_id AND p.trashed_at IS NULL
    UNION ALL
    SELECT i.id, i.parent_id, ar.rank
    FROM chain c
    JOIN item i ON i.id = c.parent_id
    JOIN access_rank ar ON ar.access_type = i.access_type
    WHERE i.trashed_at IS NULL
  )
  SELECT MIN(rank) INTO parent_rank FROM chain;

  IF parent_rank IS NOT NULL AND new_rank > parent_rank THEN
    RAISE EXCEPTION 'Child access (%) is stricter than an ancestor', NEW.access_type;
  END IF;

  RETURN NEW;
END $$;

CREATE CONSTRAINT TRIGGER chk_access_floor
AFTER INSERT OR UPDATE OF space_id, access_type, parent_id ON item
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION chk_access_not_stricter_than_ancestors();