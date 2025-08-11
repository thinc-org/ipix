// USE PostgreSQL 17.5+
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
  customType,
  AnyPgColumn,
  primaryKey,
  foreignKey,
  integer,
  jsonb,
  boolean,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { user } from "./auth";

/* CUSTOM TYPE */

/* 
citext: case-insensitive character string type
refer to: https://www.postgresql.org/docs/current/citext.html
*/
const citext = customType<{ data: string }>({
  dataType() {
    return "citext";
  },
});

/* citext length constraint */
const citextConfig = {
  minLength: 1,
  maxLength: 255,
};

/*
bytea: variable-length binary string
refer to: https://www.postgresql.org/docs/current/datatype-binary.html, https://stackoverflow.com/questions/76399047/how-to-represent-bytea-datatype-from-pg-inside-new-drizzle-orm
*/
const bytea = customType<{ data: Buffer }>({
  dataType() {
    return "bytea";
  },
});

/*
geometry(Point, 4326) that accepts { lon, lat } objects for WGS84 longitude/latitude
refer to: https://orm.drizzle.team/docs/guides/postgis-geometry-point, https://news.ycombinator.com/item?id=40220072
*/
const geometryPoint4326 = customType<{
  data: { lon: number; lat: number } | null;
  driverData: string | null;
}>({
  dataType: () => "geometry(Point, 4326)",
  toDriver(v) {
    if (v == null) return null;
    const { lon, lat } = v;
    if (!Number.isFinite(lon) || !Number.isFinite(lat)) throw new Error("...");
    if (lon < -180 || lon > 180 || lat < -90 || lat > 90)
      throw new Error("...");
    const toNumStr = (n: number) =>
      n.toFixed(8).replace(/0+$/, "").replace(/\.$/, "");
    return `SRID=4326;POINT(${toNumStr(lon)} ${toNumStr(lat)})`;
  },
  fromDriver(wkt) {
    if (!wkt) return null;
    const m = /^SRID=(\d+);POINT\(\s*([-+0-9.]+)\s+([-+0-9.]+)\s*\)$/.exec(wkt);
    if (!m) return null;
    const srid = Number(m[1]);
    if (srid !== 4326) return null;
    return { lon: parseFloat(m[2]), lat: parseFloat(m[3]) };
  },
});

// Add a geography(Point, 4326) type for generated gps_geog
const geographyPoint4326 = customType<{
  data: { lon: number; lat: number } | null;
  driverData: string | null;
}>({
  dataType: () => "geography(Point, 4326)",
  toDriver(v) {
    if (v == null) return null;
    const { lon, lat } = v;
    if (!Number.isFinite(lon) || !Number.isFinite(lat)) throw new Error("...");
    if (lon < -180 || lon > 180 || lat < -90 || lat > 90)
      throw new Error("...");
    const toNumStr = (n: number) =>
      n.toFixed(8).replace(/0+$/, "").replace(/\.$/, "");
    return `SRID=4326;POINT(${toNumStr(lon)} ${toNumStr(lat)})`;
  },
  fromDriver(wkt) {
    if (!wkt) return null;
    const m = /^SRID=(\d+);POINT\(\s*([-+0-9.]+)\s+([-+0-9.]+)\s*\)$/.exec(wkt);
    if (!m) return null;
    const srid = Number(m[1]);
    if (srid !== 4326) return null;
    return { lon: parseFloat(m[2]), lat: parseFloat(m[3]) };
  },
});

/* ENUMS */
export const spaceTypeEnum = pgEnum("space_type", ["personal", "team"]);
export const itemTypeEnum = pgEnum("item_type", ["file", "folder"]);
export const transferStatus = pgEnum("transfer_status", [
  "initiated",
  "in_progress",
  "completed",
  "aborted",
  "failed",
]);
export const fileStateEnum = pgEnum("file_state", [
  "placeholder",
  "processing",
  "verifying",
  "ready",
]);
export const blobProviderEnum = pgEnum("blob_provider", [
  "aws_s3",
  "gcs",
  "azure_blob",
  "r2",
  "minio",
]);
export const blobStateEnum = pgEnum("blob_state", [
  "staging",
  "active",
  "deleting",
  "error",
]);
export const blobStorageClassEnum = pgEnum("blob_storage_class", [
  "standard",
  "infrequent_access",
  "archive",
]);

export const fileBlobLocation = pgTable(
  "file_blob_location",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`uuidv7_sub_ms()`),
    assetId: uuid("asset_id")
      .notNull()
      .references(() => fileAsset.id, { onDelete: "cascade" }),

    provider: blobProviderEnum("provider").notNull(),
    region: text("region"),
    bucket: citext("bucket").notNull(),
    objectKey: text("object_key").notNull(),
    versionId: text("version_id"),

    isPrimary: boolean("is_primary").notNull().default(false),
    state: blobStateEnum("state").notNull().default("active"),
    storageClass: blobStorageClassEnum("storage_class"),
    etag: text("etag"),
    kmsKeyId: text("kms_key_id"),

    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
    lastAccessAt: timestamp("last_access_at", { withTimezone: true }),
  },
  (t) => [
    index("idx_blob_by_asset").on(t.assetId),
    index("idx_blob_state").on(t.state),
    index("idx_blob_bucket_key").on(t.provider, t.bucket, t.objectKey),
    uniqueIndex("uq_blob_primary_per_asset")
      .on(t.assetId)
      .where(sql`${t.isPrimary} = true`),

    // Versioning & Region safe uniqueness (two partial uniques)
    uniqueIndex("uq_blob_phys_unversioned_regnull")
      .on(t.provider, t.bucket, t.objectKey)
      .where(sql`${t.versionId} IS NULL AND ${t.region} IS NULL`),
    uniqueIndex("uq_blob_phys_unversioned_regset")
      .on(t.provider, t.region, t.bucket, t.objectKey)
      .where(sql`${t.versionId} IS NULL AND ${t.region} IS NOT NULL`),
    uniqueIndex("uq_blob_phys_versioned_regnull")
      .on(t.provider, t.bucket, t.objectKey, t.versionId)
      .where(sql`${t.versionId} IS NOT NULL AND ${t.region} IS NULL`),
    uniqueIndex("uq_blob_phys_versioned_regset")
      .on(t.provider, t.region, t.bucket, t.objectKey, t.versionId)
      .where(sql`${t.versionId} IS NOT NULL AND ${t.region} IS NOT NULL`),

    check("chk_bucket_lower", sql`${t.bucket} = lower(${t.bucket})`),
    check("chk_key_len", sql`octet_length(${t.objectKey}) BETWEEN 1 AND 1024`),
  ]
);

/* FILE ASSET */
export const fileAsset = pgTable(
  "file_asset",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`uuidv7_sub_ms()`),

    // Raw 32-byte hash (not hex). Unique for content-based deduplication.
    sha256: bytea("sha256").notNull(),
    sha256Hex: text("sha256_hex").generatedAlwaysAs(
      () => sql`encode(sha256, 'hex')`
    ), // Drizzle auto use sql`STORED`.
    sha256Prefix12: bytea("sha256_prefix12")
      .notNull()
      .generatedAlwaysAs(() => sql`substring(sha256 from 1 for 12)`),
    sha256Hex12: text("sha256_hex12").generatedAlwaysAs(
      () => sql`substring(encode(sha256, 'hex') for 12)`
    ),

    // Immutable, intrinsic file properties
    sizeByte: bigint("size_byte", { mode: "bigint" }).notNull(),
    contentType: citext("content_type").notNull(), // normalized lower-case, RFC-like regex in CHECK below
    widthPx: integer("width_px"),
    heightPx: integer("height_px"),
    exif: jsonb("exif"),

    // in alpha, for now, all column below this message will not be stored yet.
    takenAt: timestamp("taken_at", { withTimezone: true }),
    takenSrc: text("taken_src"), // exif|xmp|iptc|container|fs|user
    takenLocal: text("taken_local"),
    takenOffsetMin: smallint("taken_offset_min"),
    takenSubsec: smallint("taken_subsec"),

    cameraMake: citext("camera_make"),
    cameraModel: citext("camera_model"),
    lensMake: citext("lens_make"),
    lensModel: citext("lens_model"),
    iso: integer("iso"),
    fNumber: customType<{ data: string }>({ dataType: () => "numeric(4,2)" })(
      "f_number"
    ),
    exposureTimeNum: integer("exposure_time_num"),
    exposureTimeDen: integer("exposure_time_den"),
    focalLenMm: customType<{ data: string }>({
      dataType: () => "numeric(6,2)",
    })("focal_len_mm"),
    focalLen35mm: customType<{ data: string }>({
      dataType: () => "numeric(6,2)",
    })("focal_len_35mm"),
    exposureBiasEv: customType<{ data: string }>({
      dataType: () => "numeric(5,2)",
    })("exposure_bias_ev"),
    flashFired: boolean("flash_fired"),
    meteringMode: smallint("metering_mode"),
    exposureProgram: smallint("exposure_program"),

    orientation: smallint("orientation"),
    rotationDeg: smallint("rotation_deg"),
    colorSpace: text("color_space"),
    bitDepth: smallint("bit_depth"),
    hasIcc: boolean("has_icc"),

    gpsGeom: geometryPoint4326("gps_geom"),
    gpsGeog: geographyPoint4326("gps_geog").generatedAlwaysAs(() => sql`(gps_geom)::geography`),
    gpsAltM: customType<{ data: string }>({ dataType: () => "numeric(8,2)" })(
      "gps_alt_m"
    ),
    gpsDop: customType<{ data: string }>({ dataType: () => "numeric(6,2)" })(
      "gps_dop"
    ),
    gpsTimestamp: timestamp("gps_timestamp", { withTimezone: true }),

    durationMs: bigint("duration_ms", { mode: "bigint" }),
    videoRotationDeg: smallint("video_rotation_deg"),
    frameRate: customType<{ data: string }>({ dataType: () => "numeric(6,3)" })(
      "frame_rate"
    ),

    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index("idx_file_asset_taken_at").on(t.takenAt),
    index("idx_file_asset_sha12").on(t.sha256Prefix12),
    index("idx_file_asset_gps_geom").using("gist", t.gpsGeom),
    index("idx_file_asset_gps_geog").using("gist", t.gpsGeog),
    uniqueIndex("uq_file_asset_sha256").on(t.sha256),

    check("chk_sha256_is_32_bytes", sql`octet_length(${t.sha256}) = 32`),
    check("chk_asset_size_nonneg", sql`${t.sizeByte} >= 0`),
    check(
      "chk_dims_positive",
      sql`
        (${t.widthPx} IS NULL OR ${t.widthPx} > 0)
        AND (${t.heightPx} IS NULL OR ${t.heightPx} > 0)
      `
    ),
    check(
      "chk_dims_pair",
      sql`
      (${t.widthPx} IS NULL AND ${t.heightPx} IS NULL) OR (${t.widthPx} IS NOT NULL AND ${t.heightPx} IS NOT NULL)
      `
    ),
    check(
      "chk_rotation_deg_valid",
      sql`${t.rotationDeg} IN (0, 90, 180, 270) OR ${t.rotationDeg} IS NULL`
    ),
    check(
      "chk_video_rotation_deg_valid",
      sql`${t.videoRotationDeg} IN (0, 90, 180, 270) OR ${t.videoRotationDeg} IS NULL`
    ),
    check(
      "chk_taken_subsec",
      sql`${t.takenSubsec} BETWEEN 0 AND 999 OR ${t.takenSubsec} IS NULL`
    ),
    check(
      "chk_orientation_range",
      sql`${t.orientation} IS NULL OR ${t.orientation} BETWEEN 1 AND 8`
    ),
    check(
      "chk_fnumber_positive",
      sql`${t.fNumber} IS NULL OR ${t.fNumber}::numeric > 0`
    ),
    check(
      "chk_bit_depth_positive",
      sql`${t.bitDepth} IS NULL OR ${t.bitDepth} > 0`
    ),
    check(
      "chk_taken_offset_range",
      sql`${t.takenOffsetMin} BETWEEN -1080 AND 1080 OR ${t.takenOffsetMin} IS NULL`
    ),
    check(
      "chk_duration_ms_nonneg",
      sql`${t.durationMs} IS NULL OR ${t.durationMs} >= 0`
    ),
    check(
      "chk_frame_rate_positive",
      sql`${t.frameRate} IS NULL OR (${t.frameRate}::numeric > 0)`
    ),
    check('chk_exif_is_object', sql`${t.exif} IS NULL OR jsonb_typeof(${t.exif}) = 'object'`)
  ]
);

/* ACCESS RANK */
export const accessRank = pgTable(
  "access_rank",
  {
    accessType: text("access_type").primaryKey(),
    rank: smallint("rank").notNull().unique(),
  },
  (t) => [check("chk_rank_positive", sql`${t.rank} > 0`)]
);

/* ITEM */
export const item = pgTable(
  "item",
  {
    id: uuid("id") // used to construct s3 obj key in the format of `spaces/${spaceId}/${itemId}/${sha256:12}/...`
      .primaryKey()
      .default(sql`uuidv7_sub_ms()`),
    parentId: uuid("parent_id"),
    spaceId: uuid("space_id")
      .references((): AnyPgColumn => space.id, { onDelete: "cascade" })
      .notNull(),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }), // change to "cascade" after creating "principal" abstraction
    name: citext("name").notNull(),
    mimeType: citext("mime_type"), // long future plan: RFC 6838 compliance
    sizeByte: bigint("size_byte", { mode: "bigint" }),
    /* Generated column rewritten to avoid table alias — Postgres rule */
    itemType: itemTypeEnum("item_type").notNull(),
    assetId: uuid("asset_id"),
    purgeAt: timestamp("purge_at", { withTimezone: true }),
    trashedAt: timestamp("trashed_at", { withTimezone: true }),
    accessType: text("access_type").notNull().default("owner"),
    fileState: fileStateEnum("file_state"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    /* Generic indexes */
    index("idx_item_space").on(t.spaceId),
    index("idx_item_parent").on(t.parentId),
    index("idx_item_created_by").on(t.createdBy),
    index("idx_item_name_trgm").using(
      "gin",
      sql`((${t.name})::text gin_trgm_ops)`
    ),

    /* Optimised browsing */
    index("idx_item_asset_nn")
      .on(t.assetId)
      .where(sql`${t.assetId} IS NOT NULL`),
    index("idx_space_item_browse_live_type_name") // "items in a folder ordered by type then name in specific space" view
      .on(t.spaceId, t.parentId, sql`(${t.itemType} = 'folder') DESC`, t.name)
      .where(sql`${t.trashedAt} IS NULL`),
    index("idx_item_browse_live_type_name") // "items in a folder ordered by type then name" view
      .on(t.parentId, sql`(${t.itemType} = 'folder') DESC`, t.name)
      .where(sql`${t.trashedAt} IS NULL`),
    index("idx_space_item_browse_live_updated") // "latest updated" view
      .on(t.spaceId, t.parentId, t.updatedAt)
      .where(sql`${t.trashedAt} IS NULL`),
    index("idx_item_space_not_trashed") // "All Items" view
      .on(t.spaceId)
      .where(sql`${t.trashedAt} IS NULL`),
    index("idx_item_space_trashed")
      .on(t.spaceId)
      .where(sql`${t.trashedAt} IS NOT NULL`),

    /* Name-ordering indexes (live + trashed) */
    index("idx_item_parent_trash_type_name")
      .on(t.parentId, t.itemType, t.name)
      .where(sql`${t.trashedAt} IS NOT NULL`),
    index("idx_item_parent_live_updated")
      .on(t.parentId, t.updatedAt)
      .where(sql`${t.trashedAt} IS NULL`),
    index("idx_item_parent_trash_name")
      .on(t.parentId, t.name)
      .where(sql`${t.trashedAt} IS NOT NULL`),
    index("idx_item_access_type").on(t.accessType),

    /* Purge helper */
    index("idx_item_expire")
      .on(t.purgeAt)
      .where(sql`${t.purgeAt} IS NOT NULL`),

    /* Semantics */
    check(
      "chk_item_consistency_semantics",
      sql`
      CASE
        WHEN ${t.itemType} = 'folder' THEN ${t.mimeType} IS NULL AND ${t.sizeByte} IS NULL AND ${t.fileState} IS NULL
        WHEN ${t.itemType} = 'file' THEN
          (
            (${t.fileState} IN ('placeholder','processing','verifying') AND ${t.sizeByte} IS NULL)
            OR
            (${t.fileState} = 'ready' AND ${t.sizeByte} IS NOT NULL AND ${t.mimeType} IS NOT NULL)
          )
        ELSE FALSE
      END
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
    check("chk_item_name_not_blank", sql`btrim(${t.name}) <> ''`),
    check("chk_valid_update_at", sql`${t.createdAt} <= ${t.updatedAt}`),
    check(
      "chk_valid_delete_dt",
      sql`${t.purgeAt} IS NULL OR (${t.trashedAt} IS NOT NULL AND ${t.purgeAt} > ${t.createdAt} AND ${t.purgeAt} > ${t.trashedAt})`
    ),
    check(
      "chk_valid_trashed_at",
      sql`${t.trashedAt} IS NULL OR ${t.trashedAt} >= ${t.createdAt}`
    ),
    check(
      "chk_item_access_lower",
      sql`${t.accessType} = lower(${t.accessType})`
    ),
    check(
      "chk_root_non_trashable",
      sql`${t.parentId} IS NOT NULL OR (${t.itemType} = 'folder' AND ${t.trashedAt} IS NULL AND ${t.purgeAt} IS NULL)`
    ), // root folder cannot be moved to trash, it can only deleted when the user decide to permanently delete a space. Deleting a space and deleting a root folder is the same thing as the user shouldn't be aware of the "root folder" existance.
    // this mean that "delete space" workflow will be: init transaction -> delete space -> delete root folder -> commit (child folder will cascade themselves),
    foreignKey({
      columns: [t.accessType], // manually set to `DEFERRABLE INITIALLY DEFERRED`
      foreignColumns: [accessRank.accessType],
      name: "item_access_type_fk",
    }).onUpdate("cascade"),
    foreignKey({
      columns: [t.parentId],
      foreignColumns: [t.id],
      name: "item_parent_id_fk",
    }).onDelete("cascade"),
    foreignKey({
      columns: [t.assetId],
      foreignColumns: [fileAsset.id],
      name: "item_asset_id_fk",
    })
      .onDelete("restrict")
      .onUpdate("no action"),
  ]
);

/* SPACE */
export const space = pgTable(
  "space",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`uuidv7_sub_ms()`),
    name: citext("name").notNull(),
    ownershipType: spaceTypeEnum("ownership_type")
      .notNull()
      .default("personal"),
    rootFolderId: uuid("root_folder_id").notNull(),
    createdBy: uuid("created_by").references(() => user.id, {
      onDelete: "set null",
    }), // either "set null" or use tombstone design pattern in the future
    ownedBy: uuid("owned_by")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }), // change to "cascade" after creating "principal" abstraction. For now, a user can only delete their account if they delete all their resouces voluntarily.
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index("idx_space_created_by").on(t.createdBy),
    unique("uq_space_owner_name").on(t.ownedBy, t.name, t.ownershipType),
    uniqueIndex("uq_space_root_folder").on(t.rootFolderId),
    check("chk_valid_update_at", sql`${t.createdAt} <= ${t.updatedAt}`),
    foreignKey({
      columns: [t.rootFolderId],
      foreignColumns: [item.id],
      name: "space_root_folder_id_fkey",
    }).onDelete("no action"),
  ]
);

/* SPACE MEMBERSHIP, future (beta ?) implementation, this is just a scratch, we'll not export this yet */
const spaceMember = pgTable(
  "space_member",
  {
    spaceId: uuid("space_id")
      .notNull()
      .references((): AnyPgColumn => space.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references((): AnyPgColumn => user.id, { onDelete: "cascade" }),
    role: varchar("role", { length: 64 }), // ENUM of -> 'owner','admin','member','viewer' ?
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [primaryKey({ columns: [t.spaceId, t.userId] })]
);

/* UPLOAD SESSION */
export const uploadSession = pgTable(
  "upload_session",
  {
    key: uuid("key")
      .primaryKey()
      .default(sql`uuidv7_sub_ms()`),
    itemId: uuid("item_id")
      .notNull()
      .references(() => item.id, { onDelete: "cascade" }),
    uploadId: varchar("upload_id", { length: 512 }).notNull(),
    status: transferStatus().notNull().default("initiated"),
    expectedSize: bigint("expected_size", { mode: "bigint" }).notNull(),
    contentType: citext("content_type").default("application/octet-stream"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (t) => [
    index("idx_upload_session_stale").on(t.createdAt),
    index("idx_upload_session_item").on(t.itemId),
    index("idx_upload_session_item_active")
      .on(t.itemId)
      .where(sql`${t.status} IN ('initiated','in_progress')`),
    index("idx_upload_session_stale_active")
      .on(t.createdAt)
      .where(sql`${t.status} IN ('initiated','in_progress')`),
    index("idx_upload_session_upload_id").on(t.uploadId),
    uniqueIndex("uq_upload_item_provider").on(t.itemId, t.uploadId),
    uniqueIndex("uq_upload_active")
      .on(t.itemId)
      .where(sql`${t.status} IN ('initiated','in_progress')`),
    check("chk_expected_size_nonneg", sql`${t.expectedSize} >= 0`),
    check("chk_valid_update_at", sql`${t.createdAt} <= ${t.updatedAt}`),
    check(
      "chk_valid_complete_at",
      sql`${t.completedAt} IS NULL OR ${t.createdAt} <= ${t.completedAt}`
    ),
    check(
      "chk_upload_completed_at_sync",
      sql`(${t.completedAt} IS NULL) = (${t.status} <> 'completed')`
    ),
  ]
);

// a single public ancestor forces everything under it to be effectively public.
export const itemEffectiveAccess = pgTable(
  "item_effective_access",
  {
    id: uuid("id")
      .primaryKey()
      .references(() => item.id, { onDelete: "cascade" }),
    spaceId: uuid("space_id")
      .notNull()
      .references(() => space.id, { onDelete: "cascade" }),
    effectiveRank: smallint("effective_rank").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index("idx_iea_space").on(t.spaceId),
    index("idx_iea_space_rank").on(t.spaceId, t.effectiveRank),
  ]
);

export const itemEffectiveAccessRecalcQueue = pgTable(
  "item_effective_recalc_queue",
  {
    txid: bigint("txid", { mode: "bigint" }).notNull(),
    id: uuid("id").notNull(),
    enqueuedAt: timestamp("enqueued_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.txid, t.id] }),
    index("idx_ierq_enqueue").on(t.enqueuedAt),
  ]
);

//! MIGRATION GUIDELINE
// TODO: finish the migration guideline

/* 
0. set up db using `readme.md`.
1. Create Migration File for Better-Auth
2. Convert Better-Auth ID to UUID
3. Create `uuidv7_sub_ms()`
4. Create extension
  - CREATE EXTENSION IF NOT EXISTS pg_trgm;
  - CREATE EXTENSION IF NOT EXISTS citext;
  - CREATE EXTENSION IF NOT EXISTS postgis;
5. Create Enums
6. Create Tables
7. Create functions/triggers
8. Seed `accessRank`
*/

//! RAW SQL FILE TO ADD IN DRIZZLE MIGRATION FILE

/*
! PROBLEMETIC REGEX CHECK
```sql
(Can't put here because syntax)
*/

/*
! SEED DATA
//* << ACCESS_RANK >>
```sql
INSERT INTO access_rank(access_type, rank) VALUES ('public',1000),('team',2000),('owner',3000)  ON CONFLICT DO NOTHING;
```
*/

/*
! AUTH schemas alteration
* << Change all better-auth table to use uuid >>
```sql
-- Custom SQL migration file, put your code below! --

-- Drop all foreign key constraints that reference user table
ALTER TABLE "account" DROP CONSTRAINT "account_user_id_user_id_fk";
ALTER TABLE "session" DROP CONSTRAINT "session_user_id_user_id_fk";

-- Convert user table id to uuid first (this is the referenced column)
ALTER TABLE "user" 
ALTER COLUMN "id" TYPE uuid USING "id"::uuid;

-- Convert all referencing columns to uuid
ALTER TABLE "account"
ALTER COLUMN "user_id" TYPE uuid USING "user_id"::uuid;

ALTER TABLE "session"
ALTER COLUMN "user_id" TYPE uuid USING "user_id"::uuid;

-- Also convert primary keys of other tables if needed
ALTER TABLE "account"
ALTER COLUMN "id" TYPE uuid USING "id"::uuid;

ALTER TABLE "session"
ALTER COLUMN "id" TYPE uuid USING "id"::uuid;

ALTER TABLE "verification"
ALTER COLUMN "id" TYPE uuid USING "id"::uuid;

-- Recreate foreign key constraints
ALTER TABLE "account" 
ADD CONSTRAINT "account_user_id_user_id_fk" 
FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "session" 
ADD CONSTRAINT "session_user_id_user_id_fk" 
FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
```
*/

/*
! GENERATED COLUMNS
? ITEM table
```sql
--Add a generated column that's the name only when the row is live
ALTER TABLE item
  ADD COLUMN live_name citext
  GENERATED ALWAYS AS (CASE WHEN trashed_at IS NULL THEN name ELSE NULL END) STORED;
```
*/

/*
! Non Trigger Constraints
? ITEM table
* for big batch insert
```sql
ALTER TABLE item
  ALTER CONSTRAINT item_parent_id_fk
  DEFERRABLE INITIALLY DEFERRED;
```
* unique name for live item
```sql
-- Create a DEFERRABLE unique constraint that enforces sibling uniqueness only for live rows
ALTER TABLE item
  ADD CONSTRAINT uq_sibling_live_ci
  UNIQUE (space_id, parent_id, live_name)
  DEFERRABLE INITIALLY DEFERRED;
```
* alter item_access_type_fk that have been defined in drizzle
```sql
ALTER TABLE item
  ALTER CONSTRAINT item_access_type_fk
  DEFERRABLE INITIALLY DEFERRED;
```
? SPACE table
* ON space & root folder initialization (so we can insert both in one transaction)
HOW TO: use transaction -> generate `root_id` -> insert `space` -> insert `item` -> commit (constraints check at commit)
```
ALTER TABLE space
  ALTER CONSTRAINT space_root_folder_id_fkey
  DEFERRABLE INITIALLY DEFERRED;
```
*/

/*
! TRIGGER, Effective Access Calc/ReCalc
? << queue and batch recomputations - row level: mark dirty (deferred to end of transaction) >>
* FUNC: iea_mark_dirty
```sql
CREATE OR REPLACE FUNCTION iea_mark_dirty()
RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO item_effective_recalc_queue(txid, id)
  VALUES (txid_current(), NEW.id)
  ON CONFLICT DO NOTHING;
  RETURN NULL;
END;
$$;
```
* ON: ITEM
```sql
-- Any change that can affect effective access
DROP TRIGGER IF EXISTS iea_mark_dirty_row ON item;
CREATE CONSTRAINT TRIGGER iea_mark_dirty_row
AFTER INSERT OR UPDATE OF access_type, parent_id, trashed_at, space_id ON item
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION iea_mark_dirty();
```
* FUNC: iea_mark_dirty_on_rank
```sql
CREATE OR REPLACE FUNCTION iea_mark_dirty_on_rank()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO item_effective_recalc_queue(txid, id)
  SELECT txid_current(), i.id
  FROM item i
  WHERE i.access_type = COALESCE(NEW.access_type, OLD.access_type)
  ON CONFLICT DO NOTHING;
  RETURN NULL;
END $$;
```
* ON: ACCESS_RANK
```sql
CREATE TRIGGER iea_dirty_on_rank
AFTER INSERT OR UPDATE OR DELETE ON access_rank
FOR EACH STATEMENT
EXECUTE FUNCTION iea_mark_dirty_on_rank();
```
? << queue and batch recomputations - statement level aggregator: pick top‑most roots and recompute once per root >>
Note: Constraint triggers fire at end of transaction. PostgreSQL runs deferred triggers in name order; give this one a name that sorts last to ensure the queue is populated first.
* FUNC: iea_apply_pending
```sql
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
```
* ON: ITEM
* ON: ACCESS_RANK
```sql
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
```
? << recompute effective access in sub-tree (single pass, set‑based) >>
* FUNC: recompute_effective_access
```sql
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
```
*/

/*
! TRIGGER, Access Change
? << an item cannot be more private than an ancestor >>
* 1 FUNC
```sql
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
```
* 1 ON: ITEM
```sql
CREATE CONSTRAINT TRIGGER chk_access_floor
AFTER INSERT OR UPDATE OF space_id, access_type, parent_id ON item
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION chk_access_not_stricter_than_ancestors();
```
* 2 FUNC
```sql
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
```
* 2 ON: ITEM
```sql
DROP TRIGGER IF EXISTS chk_access_floor_stmt ON item;
CREATE CONSTRAINT TRIGGER chk_access_floor_stmt
AFTER INSERT OR UPDATE OF access_type, parent_id ON item
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION chk_access_floor_stmt();
```
*/

/*
! TRIGGER, Upload Logic
? << upload finalization >>
* FUNC: finalize_upload_with_asset_and_location
```sql
CREATE OR REPLACE FUNCTION finalize_upload_with_asset_and_location(
  _item uuid,
  _session uuid,
  _sha256 bytea,
  _content_type citext,
  _size bigint,
  _provider blob_provider,
  _region text,
  _bucket citext,
  _version_id text DEFAULT NULL,
  _etag text DEFAULT NULL,
  _storage_class blob_storage_class DEFAULT NULL,
  _set_primary boolean DEFAULT true
) RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  s upload_session%ROWTYPE;
  a_id uuid;
  canon_key text;
  loc_id uuid;
  will_make_primary boolean;
BEGIN
  -- Validate session and item
  SELECT * INTO s
  FROM upload_session
  WHERE key = _session AND item_id = _item
  FOR UPDATE;

  IF NOT FOUND OR s.status <> 'in_progress' THEN
    RAISE EXCEPTION 'Invalid session';
  END IF;

  PERFORM 1 FROM item WHERE id = _item FOR UPDATE;

  IF s.expected_size IS NOT NULL AND s.expected_size <> _size THEN
    RAISE EXCEPTION 'Size mismatch: expected %, got %', s.expected_size, _size;
  END IF;

  -- Insert or reuse file_asset
  WITH ins AS (
    INSERT INTO file_asset (sha256, size_byte, content_type)
    VALUES (_sha256, _size, COALESCE(_content_type, s.content_type))
    ON CONFLICT (sha256) DO NOTHING
    RETURNING id
  )
  SELECT id INTO a_id FROM ins
  UNION ALL
  SELECT id FROM file_asset WHERE sha256 = _sha256
  LIMIT 1;

  -- Canonical key for physical storage
  canon_key := canonical_blob_key(_sha256);

  -- Serialize per-asset mutations to avoid race on primaries
  PERFORM pg_advisory_xact_lock(hashtextextended(a_id::text, 0));

  -- Decide if we should make this location primary:
  -- only if caller asked, and none exists yet.
  will_make_primary := _set_primary AND NOT asset_has_primary(a_id);

  -- Try inserting the location (prefer canonical key)
  INSERT INTO file_blob_location (
    asset_id, provider, region, bucket, object_key, version_id,
    is_primary, state, storage_class, etag
  )
  VALUES (
    a_id, _provider, _region, lower(_bucket), canon_key, _version_id,
    will_make_primary, 'active', _storage_class, _etag
  )
  ON CONFLICT DO NOTHING
  RETURNING id INTO loc_id;

  IF loc_id IS NULL THEN
    SELECT id INTO loc_id
    FROM file_blob_location
    WHERE provider = _provider
      AND (region IS NOT DISTINCT FROM _region)
      AND bucket = lower(_bucket)
      AND object_key = canon_key
      AND (version_id IS NOT DISTINCT FROM _version_id)
    LIMIT 1;
  END IF;

  -- Update metadata (idempotent) and optionally promote to primary if none exists.
  UPDATE file_blob_location
  SET
    state = 'active',
    storage_class = COALESCE(_storage_class, storage_class),
    etag = COALESCE(_etag, etag),
    is_primary = CASE WHEN will_make_primary THEN true ELSE is_primary END
  WHERE id = loc_id;

  -- Finish the item link (same as your current finalize)
  UPDATE item
  SET mime_type = lower(COALESCE(mime_type, COALESCE(_content_type, s.content_type))),
      size_byte = _size,
      file_state = 'ready',
      asset_id = a_id
  WHERE id = _item
    AND file_state <> 'ready';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Item already finalized';
  END IF;

  UPDATE upload_session
  SET status = 'completed', completed_at = now()
  WHERE key = _session;
END $$;
```
? << ensure upload_session targets files >>
```sql
CREATE OR REPLACE FUNCTION chk_upload_targets_file()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE it RECORD;
BEGIN
  SELECT item_type, trashed_at INTO it FROM item WHERE id = NEW.item_id;
  IF it.item_type <> 'file' THEN
    RAISE EXCEPTION 'upload_session must target a file';
  END IF;
  IF it.trashed_at IS NOT NULL THEN
    RAISE EXCEPTION 'cannot upload to a trashed item';
  END IF;
  RETURN NEW;
END $$;
```
* ON: UPLOAD_SESSION
```sql
CREATE CONSTRAINT TRIGGER chk_upload_targets_file
AFTER INSERT OR UPDATE OF item_id ON upload_session
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION chk_upload_targets_file();
```
? << Keep ITEM & ASSET consistent with file states >>
* FUNC: chk_item_asset_consistency
```sql
CREATE OR REPLACE FUNCTION chk_item_asset_consistency()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE a RECORD;
BEGIN
  -- If an asset is set, the item must be a ready file and its local cache must match the asset.
  IF NEW.asset_id IS NOT NULL THEN
    IF NEW.item_type <> 'file' THEN
      RAISE EXCEPTION 'asset_id may only be set for item_type=file';
    END IF;
    IF NEW.file_state <> 'ready' THEN
      RAISE EXCEPTION 'asset_id requires file_state=ready';
    END IF;

    SELECT size_byte, content_type INTO a
    FROM file_asset WHERE id = NEW.asset_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'asset_id does not reference an existing file_asset';
    END IF;

    IF NEW.size_byte IS NULL OR NEW.mime_type IS NULL THEN
      RAISE EXCEPTION 'ready file must have size_byte and mime_type set';
    END IF;

    IF NEW.size_byte <> a.size_byte OR NEW.mime_type <> a.content_type THEN
      RAISE EXCEPTION 'item size/mime mismatch with file_asset';
    END IF;
  ELSE
    -- No asset: cannot be ready
    IF NEW.file_state = 'ready' THEN
      RAISE EXCEPTION 'ready file must reference a file_asset';
    END IF;
  END IF;

  RETURN NEW;
END $$;
```
* ON: ITEM
```sql
DROP TRIGGER IF EXISTS chk_item_asset_consistency_row ON item;
CREATE CONSTRAINT TRIGGER chk_item_asset_consistency_row
AFTER INSERT OR UPDATE OF asset_id, file_state, size_byte, mime_type, item_type ON item
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION chk_item_asset_consistency();
```
? << helper for canonical key >>
* FUNC: canonical_blob_key
```sql
CREATE OR REPLACE FUNCTION canonical_blob_key(_sha256 bytea)
RETURNS text
LANGUAGE sql IMMUTABLE STRICT AS $$
  SELECT format(
    'blobs/sha256/%s/%s/%s',
    substring(encode(_sha256,'hex') for 2),
    substring(encode(_sha256,'hex') from 3 for 2),
    encode(_sha256,'hex')
  );
$$;
```
? << check if an asset already has a primary >>
* FUNC: asset_has_primary
```sql
CREATE OR REPLACE FUNCTION asset_has_primary(_asset uuid)
RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM file_blob_location
    WHERE asset_id = _asset AND is_primary = true
  );
$$;
```

? << primary switch helper >>
* FUNC: set_primary_location
```sql
CREATE OR REPLACE FUNCTION set_primary_location(_asset uuid, _location uuid)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(_asset::text, 0));
  UPDATE file_blob_location
  SET is_primary = false
  WHERE asset_id = _asset AND is_primary = true AND id <> _location;

  UPDATE file_blob_location
  SET is_primary = true
  WHERE id = _location AND asset_id = _asset;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Location % does not belong to asset %', _location, _asset;
  END IF;
END $$;
```
*/

/*
! TRIGGER, Drive & File System Structure Logic
refer to: https://read.seas.harvard.edu/~kohler/class/cs111-s05/notes/notes14.html
? << normalize file states when inserting folder >>
* FUNC: normalize_file_state_for_folders
```sql
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
```
* ON: ITEM
```sql
DROP TRIGGER IF EXISTS normalize_file_state_for_folders_biu ON item;
CREATE TRIGGER normalize_file_state_for_folders_biu
BEFORE INSERT OR UPDATE OF item_type, file_state ON item
FOR EACH ROW
EXECUTE FUNCTION normalize_file_state_for_folders();
```
? << parent must be a folder >>
* FUNC: check_parent_is_folder
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
```
* ON: ITEM
```sql
CREATE CONSTRAINT TRIGGER chk_parent_is_folder
AFTER INSERT OR UPDATE ON item
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION check_parent_is_folder();
```
? << cycle detection >>
* FUNC: check_item_cycle
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
```
* ON: ITEM
```sql
CREATE CONSTRAINT TRIGGER chk_item_no_cycle
AFTER INSERT OR UPDATE OF parent_id ON item
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION check_item_cycle();
```
? << parent & child must share same space >>
* FUNC: check_parent_same_space
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
```
* ON: ITEM
* ON: SPACE
```sql
CREATE CONSTRAINT TRIGGER chk_parent_same_space
AFTER INSERT OR UPDATE OF parent_id, space_id ON item
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION check_parent_same_space();
```
? << root folder crud constraint >>
* FUNC: check_space_root_folder
```sql
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
```
* ON: SPACE
```sql
CREATE CONSTRAINT TRIGGER chk_space_root_folder
AFTER INSERT OR UPDATE OF root_folder_id ON space
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION check_space_root_folder();
```
? << forbid team access in personal space >>
* FUNC: chk_no_team_in_personal
```sql
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
```
* ON: ITEM
```sql
CREATE CONSTRAINT TRIGGER chk_team_access_personal
AFTER INSERT OR UPDATE OF access_type, space_id ON item
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION chk_no_team_in_personal();
```
? << Cascade all sub item in a tree to trash (like deleting a folder on pc) >> 
* FUNC: set_trash_subtree
```sql
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
```
*/

/*
! TRIGGER, Specific Mutation Constraints
? << make item id immutable >>
* FUNC: chk_upload_item_id_immutable
```sql
CREATE OR REPLACE FUNCTION chk_upload_item_id_immutable()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.item_id <> OLD.item_id THEN
    RAISE EXCEPTION 'item_id is immutable for an upload_session';
  END IF;
  RETURN NEW;
END $$;
```
* ON: UPLOAD_SESSION
```sql
CREATE TRIGGER chk_upload_item_id_immutable
BEFORE UPDATE OF item_id ON upload_session
FOR EACH ROW EXECUTE FUNCTION chk_upload_item_id_immutable();
```
? << make item asset id immutable >>
* FUNC: chk_item_asset_id_immutable
```sql
CREATE OR REPLACE FUNCTION chk_item_asset_id_immutable()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.asset_id IS NOT NULL AND NEW.asset_id IS DISTINCT FROM OLD.asset_id THEN
    RAISE EXCEPTION 'asset_id is immutable once set';
  END IF;
  RETURN NEW;
END $$;
```
* ON: ITEM
```sql
CREATE TRIGGER chk_item_asset_id_immutable
BEFORE UPDATE OF asset_id ON item
FOR EACH ROW EXECUTE FUNCTION chk_item_asset_id_immutable();
```
? << Make core properties on file_asset immutable after insert >>
* FUNC: chk_file_asset_immutable
```sql
CREATE OR REPLACE FUNCTION chk_file_asset_immutable()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.sha256 IS DISTINCT FROM OLD.sha256
       OR NEW.size_byte IS DISTINCT FROM OLD.size_byte
       OR NEW.content_type IS DISTINCT FROM OLD.content_type
       OR NEW.width_px IS DISTINCT FROM OLD.width_px
       OR NEW.height_px IS DISTINCT FROM OLD.height_px THEN
      RAISE EXCEPTION 'file_asset core properties are immutable';
    END IF;
  END IF;
  RETURN NEW;
END $$;
```
* ON: FILE_ASSET
```sql
DROP TRIGGER IF EXISTS chk_file_asset_immutable_bu ON file_asset;
CREATE TRIGGER chk_file_asset_immutable_bu
BEFORE UPDATE ON file_asset
FOR EACH ROW EXECUTE FUNCTION chk_file_asset_immutable();
```
? << Make expected_size immutable after status enters in_progress >>
* FUNC: chk_expected_size_immutable
```sql
CREATE OR REPLACE FUNCTION chk_expected_size_immutable()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'UPDATE'
     AND NEW.expected_size <> OLD.expected_size
     AND (OLD.status IN ('in_progress','completed') OR NEW.status IN ('in_progress','completed')) THEN
    RAISE EXCEPTION 'expected_size cannot change after upload starts';
  END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;
```
* ON: UPLOAD_SESSION
```sql
CREATE TRIGGER chk_expected_size_immutable
BEFORE UPDATE OF expected_size, status ON upload_session
FOR EACH ROW EXECUTE FUNCTION chk_expected_size_immutable();
```
? << restrict illegal status transitions >>
* FUNC: chk_upload_status_transition
```sql
CREATE OR REPLACE FUNCTION chk_upload_status_transition()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status NOT IN ('initiated', 'in_progress') THEN
      RAISE EXCEPTION 'Invalid initial status %', NEW.status;
    END IF;

    IF NEW.status = 'completed' AND NEW.completed_at IS NULL THEN
      RAISE EXCEPTION 'completed_at required on completion';
    END IF;

  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.status = 'initiated'
       AND NEW.status NOT IN ('initiated', 'in_progress', 'aborted', 'failed') THEN
      RAISE EXCEPTION 'Invalid transition % -> %', OLD.status, NEW.status;
    ELSIF OLD.status = 'in_progress'
       AND NEW.status NOT IN ('in_progress', 'completed', 'aborted', 'failed') THEN
      RAISE EXCEPTION 'Invalid transition % -> %', OLD.status, NEW.status;
    ELSIF OLD.status = 'completed' AND NEW.status <> 'completed' THEN
      RAISE EXCEPTION 'Cannot un-complete a session';
    END IF;

    IF NEW.status = 'completed' AND NEW.completed_at IS NULL THEN
      RAISE EXCEPTION 'completed_at required on completion';
    END IF;

  ELSE
    RAISE EXCEPTION 'Unexpected trigger operation: %', TG_OP;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```
* ON: UPLOAD_SESSION
```
CREATE TRIGGER chk_upload_status_transition
BEFORE INSERT OR UPDATE OF status, completed_at ON upload_session
FOR EACH ROW
EXECUTE FUNCTION chk_upload_status_transition();
```
*/

//! TRIGGER, General Utils
/*
? << Auto change `update_at` col >>
* FUNC: update_timestamp
```sql
CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = now();
   RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

* ON: ITEM
* ON: SPACE
* ON: UPLOAD_SESSION
```sql
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

DROP TRIGGER IF EXISTS set_timestamp ON "upload_session";
CREATE TRIGGER set_timestamp
BEFORE UPDATE ON "upload_session"
FOR EACH ROW
EXECUTE FUNCTION update_timestamp();
```
? << Prevent `created_at` updates >>
* FUNC: forbid_created_at_update
```sql
CREATE OR REPLACE FUNCTION forbid_created_at_update()
RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'created_at is immutable and cannot be modified';
  END IF;
  RETURN NEW;
END;
$$;
```
* ON: ITEM
* ON: SPACE
* ON: UPLOAD_SESSION
```sql
DROP TRIGGER IF EXISTS forbid_created_at_update_item ON item;
CREATE TRIGGER forbid_created_at_update_item
BEFORE UPDATE OF created_at ON item
FOR EACH ROW
EXECUTE FUNCTION forbid_created_at_update();

DROP TRIGGER IF EXISTS forbid_created_at_update_space ON "space";
CREATE TRIGGER forbid_created_at_update_space
BEFORE UPDATE OF created_at ON "space"
FOR EACH ROW
EXECUTE FUNCTION forbid_created_at_update();

DROP TRIGGER IF EXISTS forbid_created_at_update_upload_session ON upload_session;
CREATE TRIGGER forbid_created_at_update_upload_session
BEFORE UPDATE OF created_at ON upload_session
FOR EACH ROW
EXECUTE FUNCTION forbid_created_at_update();
```
*/

/*
! CRON
? << delete past item_effective_recalc_queue >>
* CRON: once per hour
```sql
DELETE FROM item_effective_recalc_queue
WHERE enqueued_at < now() - interval '2 days';
```
*/

/*
! DML
? << Guard item_effective_access from accidental writes >>
(THIS IS NOT MIGRATED YET)
* FUNC: 
```sql
REVOKE INSERT, UPDATE, DELETE ON item_effective_access FROM app_user;
GRANT EXECUTE ON FUNCTION recompute_effective_access(uuid) TO app_user;
```
*/

// TODO: NEW ALPHA VER
/* 
- `shared_link` table so that we can share to a specific account that matches an email
- support moving item (sub-tree) across spaces
  - add a guard that the destination parent is a folder in the target space before doing the move
ex: (using single transaction)
```sql
BEGIN;

WITH RECURSIVE sub AS (
  SELECT id FROM item WHERE id = :root
  UNION ALL
  SELECT i.id FROM item i JOIN sub s ON i.parent_id = s.id
)
UPDATE item i
SET space_id = :target_space
FROM sub
WHERE i.id = sub.id;

UPDATE item
SET parent_id = :dest_parent  -- must be a folder in target space
WHERE id = :root;

COMMIT;
```

- background job running in small batches to purge items where `now() >= purge_at` using `RETURNING` to also delete S3 obj when appropriate.
- add a trigger that rejects inserts if an enum value appears in enum_range(NULL::access_type) but is not present in access_rank
- prune partial/expensive index that were not used in real use case
*/

// TODO: BETA VER FUTURE PLAN
/*
- discuss whether `ON DELETE CASCADE` is appropriate, or if it's better to soft delete when there's no PII, and/or using `ON DELETE SET NULL`
- store an extra name_nfc normalized text for search and consistency
- Team space name uniqueness constraint
- Setup RLS
  - CRUD db policy per role and table
- Consider a retention trigger for trash (We're now only implementing hard delete)
- owned_by to reference a "principal" (user or team) instead of always a user.
- add an enum for role, a check to ensure "personal" spaces only allow the owner (or auto‑populate)
*/
