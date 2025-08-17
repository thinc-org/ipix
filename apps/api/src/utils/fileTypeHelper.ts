// Common raster/photographic formats (safe by default)
const rasterExts = [
  'png', 'jpg', 'jpeg', 'jpe', 'jfif', 'pjpeg', 'pjp',
  'gif', 'webp', 'avif',
  'bmp', 'tif', 'tiff',
  'ico', 'icns',
  'heic', 'heif', 'hif',
  'jxl',
  'jp2', 'j2k', 'jpf', 'jpm', 'jpx', 'mj2',
  'exr', 'hdr',
  'tga', 'dds',
  'pbm', 'pgm', 'ppm', 'pnm', 'pfm'
] as const;

// Camera RAW formats (big files; still "non-dangerous" as files)
const rawExts = [
  'dng',
  'cr2', 'cr3', 'crw',           // Canon
  'nef', 'nrw',                  // Nikon
  'arw', 'srf', 'sr2',           // Sony
  'orf',                         // Olympus/OM
  'rw2',                         // Panasonic
  'raf',                         // Fujifilm
  'pef',                         // Pentax
  'srw',                         // Samsung
  'rwl',                         // Leica
  '3fr',                         // Hasselblad
  'erf',                         // Epson
  'kdc', 'k25', 'dcr',           // Kodak
  'mrw',                         // Minolta
  'x3f',                         // Sigma
  'mef',                         // Mamiya
  'mos',                         // Leaf
  'iiq',                         // Phase One
  'bay',                         // Casio
  'raw'                          // Generic extension some apps use
] as const;

// Build a regex like /\.(ext1|ext2|...)(?:[?#].*)?$/i
const makeExtRegex = (exts: readonly string[]) =>
  new RegExp(`\\.(${exts.join('|')})(?:[?#].*)?$`, 'i');

// Final checker. Note: excludes SVG/SVGZ, WMF/EMF, EPS/AI by design.
export const hasAllowedExtension = (filename?: string) =>
  !!filename && makeExtRegex([...rasterExts, ...rawExts]).test(filename.trim());

// Common raster/photographic MIME types (safe by default)
const rasterMimes = [
  // Basics
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'image/avif',
  'image/bmp',
  'image/tiff',

  // Icons
  'image/vnd.microsoft.icon',  // ICO
  'image/x-icon',
  'image/icns',
  'image/x-icns',

  // HEIC/HEIF
  'image/heic',
  'image/heif',
  'image/heic-sequence',
  'image/heif-sequence',

  // JPEG XL
  'image/jxl',

  // JPEG 2000 family
  'image/jp2',
  'image/jpx',
  'image/jpm',
  'video/mj2', // Motion JPEG2000 (matches your .mj2 ext)

  // High dynamic range / formats
  'image/exr',
  'image/x-exr',
  'image/vnd.radiance',  // .hdr
  'image/x-radiance',

  // Legacy/engine formats
  'image/x-tga',         // .tga
  'image/vnd.ms-dds',    // .dds
  'image/x-dds',

  // Portable anymap family
  'image/pbm',
  'image/pgm',
  'image/ppm',
  'image/pnm',
  'image/x-portable-bitmap',
  'image/x-portable-graymap',
  'image/x-portable-pixmap',
  'image/x-portable-anymap',
  'image/x-pfm'          // .pfm (common but not IANA-registered)
] as const;

// Camera RAW MIME types (often vendor-specific, large files, still non-dangerous)
const rawMimes = [
  // DNG
  'image/dng',
  'image/x-adobe-dng',

  // Canon
  'image/x-canon-cr2',
  'image/x-canon-cr3',
  'image/x-canon-crw',

  // Nikon
  'image/x-nikon-nef',
  'image/nef',
  'image/x-nikon-nrw',

  // Sony
  'image/x-sony-arw',
  'image/x-sony-srf',
  'image/x-sony-sr2',

  // Olympus/OM
  'image/x-olympus-orf',

  // Panasonic
  'image/x-panasonic-rw2',

  // Fujifilm
  'image/x-fuji-raf',

  // Pentax
  'image/x-pentax-pef',

  // Samsung
  'image/x-samsung-srw',

  // Leica
  'image/x-leica-rwl',

  // Hasselblad
  'image/x-hasselblad-3fr',

  // Epson
  'image/x-epson-erf',

  // Kodak
  'image/x-kodak-kdc',
  'image/x-kodak-k25',
  'image/x-kodak-dcr',

  // Minolta
  'image/x-minolta-mrw',

  // Sigma
  'image/x-sigma-x3f',

  // Mamiya
  'image/x-mamiya-mef',

  // Leaf
  'image/x-leaf-mos',

  // Phase One
  'image/x-phaseone-iiq',

  // Casio
  'image/x-casio-bay',

  // Generic catch-all sometimes used
  'image/x-raw'
] as const;

// Normalize a MIME string: lowercase, strip parameters (e.g., "; charset=binary")
const normalizeMime = (mime: string) => {
  const base = mime.split(';', 1)[0];
  return base ? base.trim().toLowerCase() : '';
};

// Build a set for O(1) checks
const allowedMimeSet: ReadonlySet<string> = new Set([
  ...rasterMimes,
  ...rawMimes
]);

// Final checker. Note: excludes SVG/SVGZ, WMF/EMF, EPS/AI by design.
export const hasAllowedMime = (mime?: string) =>
  !!mime && allowedMimeSet.has(normalizeMime(mime));