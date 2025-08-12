export type UppyFileMetadata = {
  name: string;
  description?: string;
  [key: string]: unknown;
};

export type FileMetadataDisplay = {
  id: string;
  name: string;
  location?: string;
  size: number;
  type: string;
};

export type FileMetadataDisplayList = Array<{
  id: string;
  name: string;
  location?: string;
  size: number;
  type: string;
}>;

export type previewVariantName = "thumb" | "medium" | "large";
export const VARIANTS: Record<previewVariantName, { w: number; h: number; fit: "cover" | "inside"; ext: "webp" | "jpeg" | "png"; algoV: number }> = {
  thumb:  { w: 160,  h: 160,  fit: "cover",  ext: "webp", algoV: 1 },
  medium: { w: 1280, h: 1280, fit: "inside", ext: "webp", algoV: 1 },
  large:  { w: 2560, h: 2560, fit: "inside", ext: "webp", algoV: 1 },
}; // algoV: version of algo we use to transform a file to get its preview