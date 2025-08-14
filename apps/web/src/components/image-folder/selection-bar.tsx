import { X, Download, Trash2 } from "lucide-react";
import { Button } from "../ui/button";
import { useImageDownload } from "@/hooks/image/useImageDownload";

interface SelectionBarProps {
  spaceId: string
  selectedCount: number;
  selectedImageKeys: string[];
  onCancel: () => void;
  onDelete: () => void;
}

export function SelectionBar({
  spaceId,
  selectedCount,
  selectedImageKeys: selectedItemId,
  onCancel,
  onDelete,
}: SelectionBarProps) {
  const { handleDownload } = useImageDownload();

  return (
    <div className="w-full flex justify-between items-center bg-muted py-2 rounded-md shadow-sm">
      <div className="flex items-center gap-2 text-sm ">
        <Button variant="ghost" onClick={onCancel}>
          <X className="w-4 h-4" />
        </Button>
        {selectedCount} Selected
      </div>
      <div className="flex items-center text-sm">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            handleDownload(spaceId ,selectedItemId);
            onCancel();
          }}
          className="gap-1 hover:underline"
        >
          <Download className="w-4 h-4" />
          Download
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onDelete}
          className="gap-1 hover:underline"
        >
          <Trash2 className="w-4 h-4" />
          Delete
        </Button>
      </div>
    </div>
  );
}
