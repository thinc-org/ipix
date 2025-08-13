
import { customType } from "drizzle-orm/pg-core";

/* 
citext: case-insensitive character string type
refer to: https://www.postgresql.org/docs/current/citext.html
*/
export const citext = customType<{ data: string }>({
  dataType() {
    return "citext";
  },
});

/* citext length constraint */
export const citextConfig = {
  minLength: 1,
  maxLength: 255,
};

/*
bytea: variable-length binary string
refer to: https://www.postgresql.org/docs/current/datatype-binary.html, https://stackoverflow.com/questions/76399047/how-to-represent-bytea-datatype-from-pg-inside-new-drizzle-orm
*/
export const bytea = customType<{ data: Buffer }>({
  dataType() {
    return "bytea";
  },
});

/*
geometry(Point, 4326) that accepts { lon, lat } objects for WGS84 longitude/latitude
refer to: https://orm.drizzle.team/docs/guides/postgis-geometry-point, https://news.ycombinator.com/item?id=40220072
*/
export const geometryPoint4326 = customType<{
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
export const geographyPoint4326 = customType<{
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