import { SelectionBar } from "./selection-bar";
import { AddNewButton } from "./add-new-button";
import { Button } from "../ui/button";

interface FileToolBarProps {
  isSelectable: boolean;
  selectedCount: number;
  selectedImageKeys: string[];
  onCancel: () => void;
  onDelete: () => void;
  onToggleSelect: () => void;
}

export function FileToolBar({
  isSelectable,
  selectedCount,
  selectedImageKeys,
  onCancel,
  onDelete,
  onToggleSelect,
}: FileToolBarProps) {
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
          <AddNewButton />
        </>
      )}
    </div>
  );
}
