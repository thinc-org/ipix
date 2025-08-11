-- Custom SQL migration file, put your code below! --

CREATE OR REPLACE FUNCTION chk_access_floor_stmt()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE bad uuid;
BEGIN
  WITH candidates AS (
    SELECT id FROM item_effective_recalc_queue WHERE txid = txid_current()
  ),
  roots AS (
    SELECT c1.id
    FROM candidates c1
    LEFT JOIN LATERAL (
      WITH RECURSIVE anc AS (
        SELECT i.parent_id AS id
        FROM item i WHERE i.id = c1.id
        UNION ALL
        SELECT i.parent_id
        FROM anc a JOIN item i ON i.id = a.id
      )
      SELECT 1 FROM anc WHERE id IN (SELECT id FROM candidates) LIMIT 1
    ) hit ON true
    WHERE hit IS NULL
  ),
  viol AS (
    SELECT ch.id AS child_id
    FROM roots r
    JOIN LATERAL (
      WITH RECURSIVE live_down AS (
        SELECT i.id, i.parent_id
        FROM item i
        WHERE i.id = r.id AND i.trashed_at IS NULL
        UNION ALL
        SELECT c.id, c.parent_id
        FROM live_down d
        JOIN item c ON c.parent_id = d.id
        WHERE c.trashed_at IS NULL
      )
      SELECT id FROM live_down
    ) ch ON true
    JOIN item child ON child.id = ch.id
    JOIN access_rank cr ON cr.access_type = child.access_type
    JOIN LATERAL (
      WITH RECURSIVE anc AS (
        SELECT p.id, p.parent_id, ar.rank
        FROM item p
        JOIN access_rank ar ON ar.access_type = p.access_type
        WHERE p.id = child.parent_id AND p.trashed_at IS NULL
        UNION ALL
        SELECT i.id, i.parent_id, ar.rank
        FROM anc a
        JOIN item i ON i.id = a.parent_id
        JOIN access_rank ar ON ar.access_type = i.access_type
        WHERE i.trashed_at IS NULL
      )
      SELECT MIN(rank) AS floor_rank FROM anc
    ) a ON TRUE
    WHERE a.floor_rank IS NOT NULL AND cr.rank > a.floor_rank
    LIMIT 1
  )
  SELECT child_id INTO bad FROM viol;

  IF bad IS NOT NULL THEN
    RAISE EXCEPTION 'Child access is stricter than an ancestor (item=%)', bad;
  END IF;

  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS chk_access_floor_stmt ON item;
CREATE CONSTRAINT TRIGGER chk_access_floor_stmt
AFTER INSERT OR UPDATE OF access_type, parent_id ON item
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION chk_access_floor_stmt();