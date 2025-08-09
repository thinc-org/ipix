import { Header } from "@/components/base-component/header";
import { Sidebar } from "@/components/base-component/sidebar";
import { DisplayFile } from "@/components/image-folder/display-file";
import { Folder } from "@/components/image-folder/folder";
import { mockFiles, mockFolders } from "@/utils/mock/mock";
import { useAuth } from "@/lib/better-auth/auth-hooks";
import { AddNewButton } from "@/components/image-folder/add-new-button";
import { useItemsByFolder, useRootFolder } from "../item/hook";
import { useIsAssociatedWithSpace } from "./hook";

export function SpacePage({spaceInfo}: {
  spaceInfo: {
    spaceId: string,
    folderId?: string
  }
}) {
  const { session } = useAuth();

  const userInfo = {
    email: session?.user.email ?? undefined,
    name: session?.user.name ?? undefined,
    imageProfile: session?.user.image ?? undefined,
    role: "Admin",
  };

  const isAllowed = useIsAssociatedWithSpace({searchString: spaceInfo.spaceId, match: 'id'})

  let rootFolder;
  if (!spaceInfo.folderId) {
      const rootQuery = useRootFolder(spaceInfo.spaceId)
      rootFolder = rootQuery.data?.data?.data.item
  }

  const itemsQuery = useItemsByFolder({
    spaceId: spaceInfo.spaceId,
    folderId: spaceInfo.folderId ? spaceInfo.folderId : rootFolder?.id,
  })

  return (
    <div className="min-h-screen bg-background relative">
      <Header />
      <Sidebar
        userInfo={{
          email: userInfo.email,
          imageProfile: userInfo.imageProfile,
        }}
      />

      <div className="absolute top-[10vh] right-0 w-[80vw] px-8">
        {isAllowed.isError && (
          <div className="mb-4 rounded border border-red-300 bg-red-50 p-3 text-red-700">
            Failed to load space{isAllowed.error instanceof Error ? `: ${isAllowed.error.message}` : "."}
          </div>
        )}
        {isAllowed.isLoading && (
          <div className="mb-4 text-sm text-muted-foreground">Loading space…</div>
        )}
        <div className="flex justify-end py-8">
          <AddNewButton />
        </div>

        {itemsQuery.isFetching && (
          <div className="mb-4 text-sm text-muted-foreground">Loading items…</div>
        )}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6 gap-x-16">
          {itemsQuery.isSuccess ? itemsQuery.data.data?.data?.items?.map((item) => {
            if (item.itemType === 'folder') return (<Folder key={item.id} folder={{id: item.id, spaceId: item.spaceId, name: item.name, parent: item.parentId, imageCount: 0}}/>)
            if (item.itemType === 'file') return null
            return null
          }) : null}
{/*           {mockFolders.map((folder) => (
            <Folder key={folder.id} folder={folder} />
          ))}
          {mockFiles.map((file) => (
            <DisplayFile
              key={file.id}
              file={{ ...file, uploadDate: new Date() }}
            />
          ))} */}
        </div>
      </div>
    </div>
  );
}
