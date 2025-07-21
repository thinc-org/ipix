// src/stores/fileStore.ts
import { create } from 'zustand';
import {type FileMetadataDisplay, type FileMetadataDisplayList} from '@repo/shared'

interface FileState {
  files: FileMetadataDisplayList;
  selectedFileId: string | null;
  addFile: (newFile: FileMetadataDisplay) => void;
  addFiles: (newFile: FileMetadataDisplayList) => void;
  setFileState: (file: FileMetadataDisplay) => void;
  selectFile: (fileId: string | null) => void;
  clearFiles: () => void;
}

// Create the store
export const useFileStore = create<FileState>((set) => ({
  // Initial State
  files: [],
  selectedFileId: null,

  // Actions
  addFile: (newFile) => {
    
    // 'set' is used to update the state
    set((state) => ({
      files: []
    }));
  },

  addFiles: (newFile) => {
    
    // 'set' is used to update the state
    set((state) => ({
      files: []
    }));
  },

  setFileState: (File) => {

  },

  selectFile: (fileId) => set({ selectedFileId: fileId }),

  clearFiles: () => set({ files: [], selectedFileId: null }),
}));