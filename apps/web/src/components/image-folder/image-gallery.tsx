import { DisplayFile } from "@/components/image-folder/display-file";
import { useItemsByFolder, useRootFolder } from "@/features/item/hook";
import { useIsAssociatedWithSpace } from "@/features/space/hook";
import { useImageBatchFetch } from "@/hooks/image/useImageBatchFetch";
import { Folder } from "./folder";

interface ImageGalleryProps {
  isSelectable: boolean;
  selectedImageKeys: string[];
  onToggleCheckbox: (key: string) => void;
  spaceInfo: {
    spaceId: string;
    folderId?: string;
  };
}

export function ImageGallery({
  isSelectable,
  selectedImageKeys,
  onToggleCheckbox,
  spaceInfo,
}: ImageGalleryProps) {
  const isAllowed = useIsAssociatedWithSpace({
    searchString: spaceInfo.spaceId,
    match: "id",
  });

  let rootFolder;
  if (!spaceInfo.folderId) {
    const rootQuery = useRootFolder(spaceInfo.spaceId);
    rootFolder = rootQuery.data?.data?.data.item;
  }

  const effectiveFolderId = spaceInfo.folderId ?? rootFolder?.id;

  const itemsQuery = useItemsByFolder({
    spaceId: spaceInfo.spaceId,
    folderId: effectiveFolderId,
  });

  return (
    <div className="flex flex-col items-center min-h-screen box-border font-sans pl-[20vw]">
      {isAllowed.isError && (
        <div className="text-3xl font-bold mb-8 text-red-600">
          Failed to load space
          {isAllowed.error instanceof Error
            ? `: ${isAllowed.error.message}`
            : "."}
        </div>
      )}
      {isAllowed.isLoading && (
        <div className="text-3xl font-bold mb-8 text-gray-800">
          Loading space…
        </div>
      )}
      {itemsQuery.isFetching && (
        <div className="text-3xl font-bold mb-8 text-gray-800">
          Loading items…
        </div>
      )}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6 mb-8">
        {itemsQuery.isSuccess
          ? itemsQuery.data.data?.data?.items?.map((item) => {
              if (item.itemType === "folder")
                return (
                  <Folder
                    key={item.id}
                    folder={{
                      id: item.id,
                      spaceId: item.spaceId,
                      name: item.name,
                      parent: item.parentId,
                      imageCount: 0,
                    }}
                  />
                );
              if (item.itemType === "file")
                return (
                  <DisplayFile
                    key={item.id}
                    file={{
                      id: item.id,
                      name: item.name || "Untitled",
                      url: item.previewId,
                      uploadDate: item.createdAt,
                      parent: item.parentId ?? "",
                      size: "1",
                    }}
                    selectable={isSelectable}
                    selected={selectedImageKeys.includes(item.id)}
                    onToggle={() => onToggleCheckbox(item.id)}
                  />
                );
              return null;
            })
          : null}
      </div>
    </div>
  );
}
