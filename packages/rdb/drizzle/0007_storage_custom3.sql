-- Custom SQL migration file, put your code below! --

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