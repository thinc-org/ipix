-- Custom SQL migration file, put your code below! --

CREATE OR REPLACE FUNCTION recompute_effective_access(_root uuid)
RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
  floor_rank smallint;
  max_rank   smallint;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(_root::text, 0));
  PERFORM 1 FROM item WHERE id = _root;
  IF NOT FOUND THEN
    RETURN;
  END IF;

  SELECT MAX(rank) INTO max_rank FROM access_rank;

  WITH RECURSIVE anc AS (
    SELECT p.id, p.parent_id, ar.rank
    FROM item p
    JOIN access_rank ar ON ar.access_type = p.access_type
    WHERE p.id = (SELECT parent_id FROM item WHERE id = _root)
      AND p.trashed_at IS NULL
    UNION ALL
    SELECT i.id, i.parent_id, ar.rank
    FROM anc a
    JOIN item i ON i.id = a.parent_id
    JOIN access_rank ar ON ar.access_type = i.access_type
    WHERE i.trashed_at IS NULL
  )
  SELECT COALESCE(MIN(rank), max_rank) INTO floor_rank FROM anc;

  WITH RECURSIVE subtree_all AS (
    SELECT i.id
    FROM item i
    WHERE i.id = _root
    UNION ALL
    SELECT c.id
    FROM subtree_all s
    JOIN item c ON c.parent_id = s.id
  ),
  live_down AS (
    SELECT i.id, i.space_id, LEAST(ar.rank, floor_rank) AS eff_rank
    FROM item i
    JOIN access_rank ar ON ar.access_type = i.access_type
    WHERE i.id = _root
      AND i.trashed_at IS NULL
    UNION ALL
    SELECT ch.id, ch.space_id, LEAST(ar.rank, d.eff_rank)
    FROM live_down d
    JOIN item ch ON ch.parent_id = d.id
    JOIN access_rank ar ON ar.access_type = ch.access_type
    WHERE ch.trashed_at IS NULL
  ),
  purge AS (
    DELETE FROM item_effective_access iea
    WHERE iea.id IN (SELECT id FROM subtree_all)
    RETURNING 1
  )
  INSERT INTO item_effective_access (id, space_id, effective_rank)
  SELECT d.id, d.space_id, d.eff_rank
  FROM live_down d
  ON CONFLICT (id) DO UPDATE
    SET space_id = EXCLUDED.space_id,
        effective_rank = EXCLUDED.effective_rank,
        updated_at = now();
END;
$$;