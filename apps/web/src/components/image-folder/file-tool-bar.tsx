import { SelectionBar } from "./selection-bar";
import { AddNewButton } from "./add-new-button";
import { Button } from "../ui/button";

interface FileToolBarProps {
  isSelectable: boolean;
  selectedCount: number;
  selectedImageKeys: string[];
  itemsQuery: {
    isFetching: boolean;
    isLoading: boolean;
    isError: boolean;
    isSuccess: boolean;
    data?: any;
    error?: unknown;
  };
  spaceInfo: {
    spaceId: string;
    folderId: string;
  };
  onCancel: () => void;
  onToggleSelect: () => void;
}

export function FileToolBar({
  isSelectable,
  selectedCount,
  selectedImageKeys,
  spaceInfo,
  itemsQuery,
  onCancel,
  onToggleSelect,
}: FileToolBarProps) {
  return (
    <div className="sticky top-[10vh] z-50 bg-background py-4 ml-[20vw] flex justify-end gap-4">
      {isSelectable ? (
        <SelectionBar
          spaceId={spaceInfo.spaceId}
          selectedCount={selectedCount}
          selectedImageKeys={selectedImageKeys}
          onCancel={onCancel}
        />
      ) : (
        <>
        <div className=" w-full justify-start">
          {itemsQuery.isSuccess ? itemsQuery.data?.data?.data?.ancestors.map((a: any) => ' / ' + a.name) : null}
        </div>
          <Button onClick={onToggleSelect}>Select</Button>
          <AddNewButton
            spaceId={spaceInfo.spaceId}
            parentId={spaceInfo.folderId}
          />
        </>
      )}
    </div>
  );
}
