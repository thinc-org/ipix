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
export const blobLocKindEnum = pgEnum("blob_loc_kind", ["canon", "preview"]);

export const fileBlobLocation = pgTable(
  "file_blob_location",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`uuidv7_sub_ms()`),
    assetId: uuid("asset_id")
      .notNull()
      .references(() => fileAsset.id, { onDelete: "cascade" }),

    kind: blobLocKindEnum("kind").notNull().default("canon"),
    itemId: uuid("item_id").references(() => item.id, { onDelete: "cascade" }),
    variant: citext("variant"),
    algoV: smallint("algo_v"),
    ext: text("ext"),

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
      .where(sql`${t.isPrimary} = true AND ${t.kind} = 'canon'`),

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


    // Fast preview lookups per item
    index("idx_blob_preview_item").on(t.itemId).where(sql`${t.kind} = 'preview'`),

    // Logical uniqueness for previews
    uniqueIndex("uq_preview_identity")
      .on(t.assetId, t.itemId, t.variant, t.algoV, sql`COALESCE(${t.ext}, '')`)
      .where(sql`${t.kind} = 'preview'`),

    // Checks
    check("chk_bucket_lower", sql`${t.bucket} = lower(${t.bucket})`),
    check("chk_key_len", sql`octet_length(${t.objectKey}) BETWEEN 1 AND 1024`),
    check(
      "chk_fbl_kind_columns",
      sql`
        (${t.kind} = 'canon' AND ${t.itemId} IS NULL AND ${t.variant} IS NULL AND ${t.algoV} IS NULL AND ${t.ext} IS NULL)
        OR
        (${t.kind} = 'preview' AND ${t.itemId} IS NOT NULL AND ${t.variant} IS NOT NULL AND ${t.algoV} IS NOT NULL)
      `
    ),
    check(
      "chk_fbl_primary_only_canon",
      sql`(${t.kind} = 'canon') OR (${t.kind} = 'preview' AND ${t.isPrimary} = false)`
    ),
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
    sha256Prefix24: bytea("sha256_prefix24")
      .notNull()
      .generatedAlwaysAs(() => sql`substring(sha256 from 1 for 24)`),
    sha256Hex24: text("sha256_hex24").generatedAlwaysAs(
      () => sql`substring(encode(sha256, 'hex') for 24)`
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
    index("idx_file_asset_sha24").on(t.sha256Prefix24),
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
    id: uuid("id") // used to construct s3 obj key in the format of `spaces/${spaceId}/${itemId}/${sha256:24}/...`
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

export const previewRepathQueue = pgTable(
  "preview_repath_queue",
  {
    id: uuid("id").primaryKey().default(sql`uuidv7_sub_ms()`),

    fblId: uuid("fbl_id")
      .notNull()
      .references(() => fileBlobLocation.id, { onDelete: "cascade" }),
    itemId: uuid("item_id")
      .notNull()
      .references(() => item.id, { onDelete: "cascade" }),
    assetId: uuid("asset_id")
      .notNull()
      .references(() => fileAsset.id, { onDelete: "cascade" }),

    fromSpace: uuid("from_space")
      .notNull()
      .references(() => space.id, { onDelete: "cascade" }),
    toSpace: uuid("to_space")
      .notNull()
      .references(() => space.id, { onDelete: "cascade" }),

    provider: blobProviderEnum("provider").notNull(),
    region: text("region"),
    bucket: citext("bucket").notNull(),

    oldKey: text("old_key").notNull(),
    newKey: text("new_key").notNull(),

    variant: citext("variant").notNull(),
    algoV: smallint("algo_v").notNull(),
    ext: text("ext"),

    enqueuedAt: timestamp("enqueued_at", { withTimezone: true }).defaultNow().notNull(),
    attempts: integer("attempts").notNull().default(0),
    processedAt: timestamp("processed_at", { withTimezone: true }),
    error: text("error"),
  },
  (t) => [
    // Prevent duplicate tasks per preview for a given destination space
    uniqueIndex("uq_prq_fbl_to_space").on(t.fblId, t.toSpace),
  ]
);

/*
! ONLY READ THIS PART IF YOU'RE NOT GOING TO DO DB MIGRATION.
* list of useful service layer functions in db for backend dev to call
1. finalize_upload_with_asset_and_location(...)
  What it does:
    - Validates the upload_session and item.
    - Upserts the file_asset by sha256.
    - Inserts or reuses a file_blob_location using a canonical key.
    - Optionally makes it the primary location (if none exists).
    - Finalizes the item: sets size, mime, file_state=ready, links asset.
    - Marks the upload_session completed.
  When to call:
    - At the end of your object storage upload, to atomically finalize the file in the DB.

2. set_primary_location(_asset, _location)
  What it does:
    - Switches which blob location is the primary for an asset and clears any previous primary, safely.
  When to call:
    - If you add/choose a new physical location (e.g., move buckets/regions) and need to promote it.

3. set_trash_subtree(_root, _trashed_at, _purge_at DEFAULT NULL)
  What it does:
    - Cascades trash or untrash across a subtree and sets purge_at if trashed.
  When to call:
    - Implement "Move to Trash" or "Restore" from trash. Example (trash for 30 days)

4. asset_sha24(_asset uuid)
  What it does:
    - Looks up the asset’s SHA-256 and returns the first 24 hex characters as text.
  When to call:
    - Whenever you need to construct a preview key for an asset (e.g., in triggers, workers, or app code).

5. build_preview_key(_space uuid, _item uuid, _sha24 text, _variant citext, _algov smallint, _ext text)
  What it does:
    - Builds the exact preview object key: `spaces/${spaceId}/${itemId}/${sha24}/previews/${variant}@v${algoV}[.ext]`.
    - Normalizes variable
  When to call:
    - In workers preparing to upload a preview so they can write to the correct path.

6. upsert_preview_location(_asset uuid, _item uuid, _provider blob_provider, _region text, _bucket citext, _version_id text DEFAULT NULL, _variant citext, _algo_v smallint, _ext text DEFAULT NULL, _storage_class blob_storage_class DEFAULT NULL, _etag text DEFAULT NULL)
  What it does:
    - Inserts a `file_blob_location` row for a preview (kind = `preview`) if one doesn’t already exist for the same `(asset, item, variant, algo_v, ext)`.
    - Returns ```(id, object_key)``` for the preview location; idempotent on repeated calls with the same identity.
    - Normalizes variable
  When to call:
    - Right before or right after uploading a preview to storage:
      - Before: call it to get `object_key`, then upload to that path.
      - After: call it to register metadata if you already uploaded to that path.
    - In your preview processing pipeline to ensure one row per logical preview variant/version.

7. list_preview_repath_tasks(_limit int DEFAULT 100)
  What it does:
    - Lists pending preview re-path tasks from `preview_repath_queue` (where `processed_at IS NULL`), ordered by enqueue time.
    - Returns all metadata the worker needs to copy from `old_key` to `new_key` (including provider, bucket, region).
  When to call:
    - In your background worker’s polling loop to fetch the next batch of tasks to process.
    - At worker startup or on a schedule to drive throughput with backoff and batching.

8. mark_preview_repath_done(_task uuid, _version_id text DEFAULT NULL, _etag text DEFAULT NULL)
  What it does:
    - Marks a re-path task as completed and updates the corresponding `file_blob_location` to point at the new key.
    - Optionally records `version_id` and `etag` returned by the object store after the copy.
    - Sets `processed_at` so the task is not picked up again.
  When to call:
    - Immediately after your worker has successfully copied the object from `old_key` to `new_key` in storage.
    - As part of the worker’s "commit" step for each task to keep DB state in sync with storage.

9. mark_preview_repath_failed(_task uuid, _error text)
  What it does:
    - Increments the task’s `attempts` counter and stores the latest error message for diagnostics.
    - Leaves the task pending so it can be retried by the worker with backoff logic.
  When to call:
    - Whenever the worker encounters a transient error copying or updating (e.g., network timeouts, rate limits).
    - On hard failures too, so your monitoring can alert and you can intervene or dead-letter after a max-attempts policy.

* Postgres features you might need to know
1. DEFERRABLE INITIALLY DEFERRED
  What it is:
    - Make validations run at COMMIT.
  What you should do:
    - Always wrap multi-row operations in a transaction so constraints can validate the final state.
*/

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
- owned_by to reference a "principal" (user or team) instead of always a user.
- add an enum for role, a check to ensure "personal" spaces only allow the owner (or auto‑populate)
*/
