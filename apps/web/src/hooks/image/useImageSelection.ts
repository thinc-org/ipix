import { useState } from "react";

export function useImageSelection() {
  const [isSelectable, setIsSelectable] = useState(false);
  const [selectedImageKeys, setSelectedImageKeys] = useState<string[]>([]);

  const toggleSelectable = () => {
    setIsSelectable((prev) => !prev);
    if (isSelectable) clearSelection();
  };

  const toggleCheckbox = (key: string) => {
    setSelectedImageKeys((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const clearSelection = () => {
    setSelectedImageKeys([]);
  };

  return {
    isSelectable,
    selectedImageKeys,
    toggleSelectable,
    toggleCheckbox,
    clearSelection,
  };
}
