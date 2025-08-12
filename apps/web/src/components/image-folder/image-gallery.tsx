import { DisplayFile } from "@/components/image-folder/display-file";
import { Folder } from "./folder";
import type { storageSchema } from "@repo/rdb/schema";

type ItemRow = typeof storageSchema.item.$inferSelect;
type ItemWithChildCount = ItemRow & { childCount?: number };

interface ImageGalleryProps {
  isSelectable: boolean;
  selectedImageKeys: string[];
  onToggleCheckbox: (key: string) => void;
  // Query states are provided by parent to keep this component presentational
  itemsQuery: {
    isFetching: boolean;
    isLoading: boolean;
    isError: boolean;
    isSuccess: boolean;
    data?: any;
    error?: unknown;
  };
}

export function ImageGallery({
  isSelectable,
  selectedImageKeys,
  onToggleCheckbox,
  itemsQuery,
}: ImageGalleryProps) {
  // All fetching logic has been moved to the parent component.

  return (
    <div className="flex flex-col items-center min-h-screen box-border font-sans pl-[20vw]">
      {itemsQuery.isError && (
        <div className="text-3xl font-bold mb-8 text-red-600">
          Failed to load space
          {itemsQuery.error instanceof Error
            ? `: ${itemsQuery.error.message}`
            : "."}
        </div>
      )}
      {itemsQuery.isLoading && (
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
          ? itemsQuery.data.data?.data?.items?.map((item: ItemWithChildCount) => {
              if (item.itemType === "folder")
                return (
                  <Folder
                    key={item.id}
                    folder={{
                      id: item.id,
                      spaceId: item.spaceId,
                      name: item.name,
                      parent: item.parentId,
                      imageCount: item.childCount ?? 0,
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
                      url: "", // TODO: preview URL to be wired later
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
