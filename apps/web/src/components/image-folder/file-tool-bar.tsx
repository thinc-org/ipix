import { SelectionBar } from "./selection-bar";
import { AddNewButton } from "./add-new-button";
import { Button } from "../ui/button";
import { useRootFolder } from "@/features/item/hook";

interface FileToolBarProps {
  isSelectable: boolean;
  selectedCount: number;
  selectedImageKeys: string[];
  spaceInfo: {
    spaceId: string;
    folderId?: string;
  };
  onCancel: () => void;
  onDelete: () => void;
  onToggleSelect: () => void;
}

export function FileToolBar({
  isSelectable,
  selectedCount,
  selectedImageKeys,
  spaceInfo,
  onCancel,
  onDelete,
  onToggleSelect,
}: FileToolBarProps) {
  let rootFolder;
  if (!spaceInfo.folderId) {
    const rootQuery = useRootFolder(spaceInfo.spaceId);
    rootFolder = rootQuery.data?.data?.data.item;
  }

  const effectiveFolderId = spaceInfo.folderId ?? rootFolder?.id;
  return (
    <div className="sticky top-[10vh] z-50 bg-background py-4 ml-[20vw] flex justify-end gap-4">
      {isSelectable ? (
        <SelectionBar
          selectedCount={selectedCount}
          selectedImageKeys={selectedImageKeys}
          onCancel={onCancel}
          onDelete={onDelete}
        />
      ) : (
        <>
          <Button onClick={onToggleSelect}>Select</Button>
          <AddNewButton
            spaceId={spaceInfo.spaceId}
            parentId={effectiveFolderId}
          />
        </>
      )}
    </div>
  );
}
