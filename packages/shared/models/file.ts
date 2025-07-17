export type UppyFileMetadata = {
  name: string
  description?: string
  [key: string]: unknown
}

export type FileMetadataDisplay = {
    id: string
    name: string
    location?: string
    size: number
    type: string
  }

export type FileMetadataDisplayList = Array<{
    id: string
    name: string
    location?: string
    size: number
    type: string
  }>