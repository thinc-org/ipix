-- Custom SQL migration file, put your code below! --

-- Custom SQL migration file, put your code below! --

CREATE OR REPLACE FUNCTION iea_apply_pending()
RETURNS TRIGGER
LANGUAGE plpgsql AS $$
DECLARE
  r RECORD;
BEGIN
  -- Find candidates for this transaction
  FOR r IN
    WITH candidates AS (
      SELECT id FROM item_effective_recalc_queue
      WHERE txid = txid_current()
    ),
    -- Keep only those whose ancestor is not also a candidate (top-most roots)
    roots AS (
      SELECT c1.id
      FROM candidates c1
      LEFT JOIN LATERAL (
        WITH RECURSIVE anc AS (
          SELECT i.parent_id AS id
          FROM item i
          WHERE i.id = c1.id
          UNION ALL
          SELECT i.parent_id
          FROM anc a
          JOIN item i ON i.id = a.id
        )
        SELECT 1
        FROM anc
        WHERE id IN (SELECT id FROM candidates)
        LIMIT 1
      ) hit ON true
      WHERE hit IS NULL
    )
    SELECT DISTINCT id FROM roots
  LOOP
    PERFORM recompute_effective_access(r.id);
  END LOOP;

  -- Clear items for this transaction
  DELETE FROM item_effective_recalc_queue
  WHERE txid = txid_current();

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS zzzzz_iea_apply_pending_stmt ON item;
CREATE CONSTRAINT TRIGGER zzzzz_iea_apply_pending_stmt
AFTER INSERT OR UPDATE OF access_type, parent_id, trashed_at ON item
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION iea_apply_pending();

DROP TRIGGER IF EXISTS zzzzz_iea_apply_pending_stmt_rank ON access_rank;
CREATE CONSTRAINT TRIGGER zzzzz_iea_apply_pending_stmt_rank
AFTER INSERT OR UPDATE OR DELETE ON access_rank
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION iea_apply_pending();