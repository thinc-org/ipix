import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'


type UploadStatus = 'queued' | 'uploading' | 'success' | 'error' | 'canceled'
type UploadItem = {
  id: string
  file: File
  targetSpaceId: string,
  targetFolderId: string
  progress: number // 0..100
  status: UploadStatus
  error?: string
  cancel?: () => void
}

type DownloadStatus = 'queued' | 'downloading' | 'success' | 'error' | 'canceled'
type DownloadItem = {
  id: string
  progress: number
  status: DownloadStatus
  error?: string
  cancel?: () => void
}

type UIState = {
  newFolderOpen: boolean
  uploadDialogOpen: boolean
  selectedItemIds: Set<string>
}

type State = {
  ui: UIState
  uploads: Record<string, UploadItem>
  downloads: Record<string, DownloadItem>
  openNewFolder: () => void
  closeNewFolder: () => void
  openUpload: () => void
  closeUpload: () => void
  selectItem: (id: string) => void
  clearSelection: () => void
  enqueueUploads: (files: File[], spaceId: string, folderId: string) => string[] // returns ids
  setUploadProgress: (id: string, progress: number) => void
  setUploadStatus: (id: string, status: UploadStatus, error?: string) => void
  setUploadCancel: (id: string, cancel: () => void) => void
  removeUpload: (id: string) => void
  // similar for downloads...
}

export const useTransferStore = create<State>()(
  devtools(
    immer((set) => ({
      ui: { newFolderOpen: false, uploadDialogOpen: false, selectedItemIds: new Set() },
      uploads: {},
      downloads: {},
      openNewFolder: () => set((s) => { s.ui.newFolderOpen = true }),
      closeNewFolder: () => set((s) => { s.ui.newFolderOpen = false }),
      openUpload: () => set((s) => { s.ui.uploadDialogOpen = true }),
      closeUpload: () => set((s) => { s.ui.uploadDialogOpen = false }),
      selectItem: (id) => set((s) => { s.ui.selectedItemIds.add(id) }),
      clearSelection: () => set((s) => { s.ui.selectedItemIds.clear() }),
      enqueueUploads: (files, spaceId, folderId) => {
        const ids: string[] = []
        set((s) => {
          for (const file of files) {
            const id = Bun.randomUUIDv7()
            ids.push(id)
            s.uploads[id] = { id, file, targetSpaceId: spaceId, targetFolderId: folderId, progress: 0, status: 'queued' }
          }
        })
        return ids
      },
      setUploadProgress: (id, progress) => set((s) => { if (s.uploads[id]) s.uploads[id].progress = progress }),
      setUploadStatus: (id, status, error) => set((s) => {
        const u = s.uploads[id]; if (!u) return
        u.status = status; u.error = error
        if (status === 'success') u.progress = 100
      }),
      setUploadCancel: (id, cancel) => set((s) => { if (s.uploads[id]) s.uploads[id].cancel = cancel }),
      removeUpload: (id) => set((s) => { delete s.uploads[id] }),
    }))
  )
)

/* 
Upload flow (store + mutation + progress)
- Keep UI/queue in Zustand.
- Have a mutation that accepts (file, onProgress, signal).
- Use AbortController to support cancel.
 */
/*  
const uploadMutation = useMutation({
  mutationFn: async (vars: { spaceId: string; folderId: string; file: File; onProgress: (n: number) => void; signal: AbortSignal }) => {
    // Use your S3 upload or API; ensure it reports progress and respects AbortSignal.
    return uploadFile(vars) // calls vars.onProgress(progress)
  },
  onSuccess: () => {
    // Invalidate items to show the new file
  }
})

function startUploadForIds(spaceId: string, folderId: string, ids: string[]) {
  const store = useTransferStore.getState()
  for (const id of ids) {
    const u = store.uploads[id]
    if (!u) continue
    const controller = new AbortController()
    store.setUploadCancel(id, () => controller.abort())
    store.setUploadStatus(id, 'uploading')
    uploadMutation.mutate(
      {
        spaceId,
        folderId,
        file: u.file,
        onProgress: (p) => store.setUploadProgress(id, p),
        signal: controller.signal,
      },
      {
        onSuccess: () => {
          store.setUploadStatus(id, 'success')
          queryClient.invalidateQueries({ queryKey: ['items', spaceId, folderId] })
        },
        onError: (e: any) => {
          store.setUploadStatus(id, e?.name === 'AbortError' ? 'canceled' : 'error', e?.message)
        },
      }
    )
  }
}
*/