// USE PG16+
import {
  pgTable,
  text,
  timestamp,
  varchar,
  pgEnum,
  bigint,
  uuid,
  unique,
  index,
  check,
  uniqueIndex,
  smallint,
  pgMaterializedView,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { user } from "./auth";

/* ENUMS */
const spaceTypeEnum = pgEnum("space_type", ["personal", "team"]);
const accessTypeEnum = pgEnum("access_type", ["owner", "team", "public"]);
const itemTypeEnum = pgEnum("item_type", ["file", "folder"]);
const transferStatus = pgEnum("transfer_status", ["initiated", "in_progress", "completed", "aborted", "failed"])

/* SPACE */
const spaceConstraints = (t: any) => [
  unique("uq_space_owner_name").on(t.ownedBy, t.name),
  index("idx_space_created_by").on(t.createdBy),
];

export const space = pgTable(
  "space",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`uuidv7_sub_ms()`),
    name: varchar("name", { length: 256 }).notNull(),
    type: spaceTypeEnum().notNull(),

    createdBy: uuid("created_by")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    ownedBy: uuid("owned_by")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessType: accessTypeEnum().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  spaceConstraints
);

/* ITEM */
const itemConstraints = (t: any) => [
  /* Generic indexes */
  index("idx_item_space").on(t.spaceId),
  index("idx_item_parent").on(t.parentId),
  index("idx_item_trash_time").on(t.trashedDeleteDT),
  index("idx_item_created_by").on(t.createdBy),
  index("idx_item_space_parent_created").on(t.spaceId, t.parentId, t.createdAt),

  /* Optimised browsing */
  index("idx_item_space_parent").on(t.spaceId, t.parentId),

  index("idx_item_space_not_trashed")
    .on(t.spaceId)
    .where(sql`${t.trashedDeleteDT} IS NULL`),

  index("idx_item_space_trashed")
    .on(t.spaceId)
    .where(sql`${t.trashedDeleteDT} IS NOT NULL`),

  /* Name-ordering indexes (live + trashed) */
  index("idx_item_parent_live_name")
    .on(t.parentId, t.name)
    .where(sql`${t.trashedDeleteDT} IS NULL`),

  index("idx_item_parent_trash_name")
    .on(t.parentId, t.name)
    .where(sql`${t.trashedDeleteDT} IS NOT NULL`),

  /* Purge helper */
  index("idx_item_expire")
    .on(t.trashedDeleteDT)
    .where(sql`${t.trashedDeleteDT} IS NOT NULL`),

  /* Uniqueness */
  uniqueIndex("uq_sibling_live")
    .on(t.spaceId, t.parentId, t.name)
    .where(sql`${t.trashedDeleteDT} IS NULL`),

  uniqueIndex("uq_root_live")
    .on(t.spaceId, t.name)
    .where(sql`${t.parentId} IS NULL AND ${t.trashedDeleteDT} IS NULL`),

  /* Semantics */
  check(
    "chk_item_semantics",
    sql`
      (
        (${t.itemType} = 'file' AND ${t.mimeType} IS NOT NULL AND ${t.sizeByte} IS NOT NULL)
        OR
        (${t.itemType} = 'folder' AND ${t.mimeType} IS NULL AND ${t.sizeByte} IS NULL)
      )
    `
  ),
  check(
    "chk_item_not_self_parent",
    sql`${t.parentId} IS NULL OR ${t.parentId} <> ${t.id}`
  ),
  check(
    "chk_size_non_negative",
    sql`${t.sizeByte} IS NULL OR ${t.sizeByte} >= 0::bigint`
  ),
  check("chk_item_name_not_empty", sql`${t.name} <> ''`),
  check(
    "chk_valid_delete_dt",
    sql`${t.trashedDeleteDT} IS NULL OR ${t.trashedDeleteDT} > ${t.createdAt}`
  ),
];

export const item = pgTable(
  "item",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`uuidv7_sub_ms()`),
    /* TEMP FOR ALPHA: previewId */
    previewId: uuid("preview_id")
      .default(sql`uuidv7_sub_ms()`)
      .notNull(),
    parentId: uuid("parent_id").references((): any => item.id, {
      onDelete: "cascade",
    }),
    spaceId: uuid("space_id")
      .references(() => space.id, { onDelete: "cascade" })
      .notNull(),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 256 }).notNull(),
    mimeType: varchar("mime_type", { length: 255 }),
    sizeByte: bigint("size_byte", { mode: "bigint" }),
    /* Generated column rewritten to avoid table alias — Postgres rule */
    itemType: itemTypeEnum().generatedAlwaysAs(
      (): any =>
        sql`CASE WHEN mime_type IS NULL 
                   THEN 'folder'::item_type 
                   ELSE 'file'::item_type 
              END`
    ),
    trashedDeleteDT: timestamp("trashed_delete_dt", { withTimezone: true }),
    accessType: accessTypeEnum().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  itemConstraints
);

/* ACCESS RANK */
const accessRankConstraints = (t: any) => [
  /* rank must be positive */
  check("chk_rank_positive", sql`${t.rank} > 0`),

  /* rank must match the enum value */
  check(
    "chk_rank_matches_enum",
    sql`
       (${t.accessType} = 'public' AND ${t.rank} = 1000)
    OR (${t.accessType} = 'team'   AND ${t.rank} = 2000)
    OR (${t.accessType} = 'owner'  AND ${t.rank} = 3000)
    `
  ),
];

export const accessRank = pgTable(
  "access_rank",
  {
    accessType: accessTypeEnum().primaryKey(),
    rank: smallint("rank").notNull().unique(),
  },
  accessRankConstraints
);

export const uploadSession = pgTable("upload_session", {
  itemId: uuid('item_id'),
  key: uuid('key').notNull().unique().primaryKey(),
  uploadId: varchar('upload_id', { length: 255 }),
  status: transferStatus(),
  expectedSize: bigint("size_byte", { mode: "bigint" }),
  contentType: varchar('content_type', { length: 255 })
});

/* EFFECTIVE-ACCESS MATERIALISED VIEW */
export const itemWithEffectiveAccess = pgMaterializedView(
  "item_with_effective_access",
  {
    id: uuid("id"),
    spaceId: uuid("space_id"),
    effectiveRank: smallint("effective_rank"),
    effectiveAccess: accessTypeEnum("effective_access"),
  }
).as(sql`
  WITH RECURSIVE chain AS (
    SELECT  i.id,
            i.space_id,
            i.parent_id,
            i.access_type,
            ar.rank
    FROM   item i
    JOIN   access_rank ar USING (access_type)

    UNION ALL

    SELECT  c.id,
            p.space_id,
            p.parent_id,
            p.access_type,
            ar.rank
    FROM   chain c
    JOIN   item p ON p.id = c.parent_id
    JOIN   access_rank ar USING (access_type)
  ),
  ranked AS (
    SELECT
      id,
      space_id,
      access_type,
      rank,
      ROW_NUMBER() OVER (PARTITION BY id, space_id ORDER BY rank ASC) AS rn
    FROM chain
  )
  SELECT
    id,
    space_id,
    rank        AS effective_rank,
    access_type AS effective_access
  FROM ranked
  WHERE rn = 1;
`);

/* 
RAW SQL FILE ADDED IN DRIZZLE MIGRATION FILE

A. unique index for the MV  (stand-alone migration)
```sql
CREATE UNIQUE INDEX CONCURRENTLY mv_item_pk
  ON item_with_effective_access (id, space_id);

REFRESH MATERIALIZED VIEW CONCURRENTLY public.item_with_effective_access;
```

B. deferred FK on parent_id (big-batch inserts)
```sql
ALTER TABLE item
  ALTER CONSTRAINT item_parent_id_fkey
  DEFERRABLE INITIALLY DEFERRED;
```

C. triggers
-- 1. update trigger --
```sql
CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = CURRENT_TIMESTAMP;
   RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_timestamp ON item;
CREATE TRIGGER set_timestamp
BEFORE UPDATE ON item
FOR EACH ROW
EXECUTE FUNCTION update_timestamp();

DROP TRIGGER IF EXISTS set_timestamp ON "space";
CREATE TRIGGER set_timestamp
BEFORE UPDATE ON "space"
FOR EACH ROW
EXECUTE FUNCTION update_timestamp();
```

-- 2. parent must be a folder --
```sql
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
```

-- 3. cycle detection --
```sql
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
```

-- 4. parent & child must share same space --
```sql
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
```

D. Change `user.id` to use uuid 
```sql
ALTER TABLE user
ALTER COLUMN id
  TYPE uuid
  USING id::uuid;

ALTER TABLE user
  ADD CONSTRAINT DF_Constraint_uuidv7
  DEFAULT uuidv7_sub_ms() FOR id;
```

E. seed data
-- 1. access rank --
```sql
INSERT INTO access_rank(access_type, rank) VALUES ('public',1000),('team',2000),('owner',3000)  ON CONFLICT DO NOTHING;
```
*/
