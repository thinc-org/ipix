// Keep in sync with apps/api/src/utils/fileTypeHelper.ts
// We duplicate minimal logic client-side to filter selection

// ext whitelist from server (raster + raw)
export const allowedExts = [
  // raster
  'png','jpg','jpeg','jpe','jfif','pjpeg','pjp','gif','webp','avif','bmp','tif','tiff','ico','icns','heic','heif','hif','jxl','jp2','j2k','jpf','jpm','jpx','mj2','exr','hdr','tga','dds','pbm','pgm','ppm','pnm','pfm',
  // raw
  'dng','cr2','cr3','crw','nef','nrw','arw','srf','sr2','orf','rw2','raf','pef','srw','rwl','3fr','erf','kdc','k25','dcr','mrw','x3f','mef','mos','iiq','bay','raw'
];

const makeExtRegex = (exts: readonly string[]) => new RegExp(`\.(${exts.join('|')})(?:[?#].*)?$`, 'i');
const extRegex = makeExtRegex(allowedExts);

export function hasAllowedExtension(filename?: string) {
  return !!filename && extRegex.test(filename.trim());
}

// MIME whitelist from server (raster + raw)
export const allowedMimes = new Set([
  'image/png','image/jpeg','image/gif','image/webp','image/avif','image/bmp','image/tiff','image/vnd.microsoft.icon','image/x-icon','image/icns','image/x-icns','image/heic','image/heif','image/heic-sequence','image/heif-sequence','image/jxl','image/jp2','image/jpx','image/jpm','video/mj2','image/exr','image/x-exr','image/vnd.radiance','image/x-radiance','image/x-tga','image/vnd.ms-dds','image/x-dds','image/pbm','image/pgm','image/ppm','image/pnm','image/x-portable-bitmap','image/x-portable-graymap','image/x-portable-pixmap','image/x-portable-anymap','image/x-pfm',
  'image/dng','image/x-adobe-dng','image/x-canon-cr2','image/x-canon-cr3','image/x-canon-crw','image/x-nikon-nef','image/x-nikon-nrw','image/x-sony-arw','image/x-sony-srf','image/x-sony-sr2','image/x-olympus-orf','image/x-panasonic-rw2','image/x-fuji-raf','image/x-pentax-pef','image/x-samsung-srw','image/x-leica-rwl','image/x-hasselblad-3fr','image/x-epson-erf','image/x-kodak-kdc','image/x-kodak-k25','image/x-kodak-dcr','image/x-minolta-mrw','image/x-sigma-x3f','image/x-mamiya-mef','image/x-leaf-mos','image/x-phaseone-iiq','image/x-casio-bay','image/x-raw'
]);

function normalizeMime(m: string) { return m.split(';', 1)[0]?.trim().toLowerCase() || ''; }
export function hasAllowedMime(mime?: string) {
  return !!mime && allowedMimes.has(normalizeMime(mime));
}

export function filterAllowedFiles(files: File[]): File[] {
  return files.filter((f) => hasAllowedMime(f.type) || hasAllowedExtension(f.name));
}

// Build accept attribute value for input[type="file"]
export const fileInputAccept = [
  // add a broad image/* for most browsers
  'image/*',
  // plus explicit mimes (covers RAW types that aren't under image/*)
  ...Array.from(allowedMimes.values()),
  // and file extensions
  ...allowedExts.map((e) => `.${e}`),
].join(',');
