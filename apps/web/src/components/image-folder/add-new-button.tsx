import { useRef, useState, useMemo } from "react";
import { Button } from "../ui/button";
import { CreateFolderButton } from ".";
import { useOnClickOutside } from "usehooks-ts";
import { useTransferStore } from "@/stores/fileStores";

export function AddNewButton({
  spaceId,
  parentId,
}: {
  spaceId: string;
  parentId?: string;
}) {
  const [menuVisible, setMenuVisible] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const canCreate = useMemo(() => Boolean(spaceId && parentId), [spaceId, parentId]);
  const openNewFolder = useTransferStore((s) => s.openNewFolder);

  useOnClickOutside(menuRef as React.RefObject<HTMLElement>, () => {
    setMenuVisible(false);
  });

  const toggleMenu = () => {
    setMenuVisible(!menuVisible);
  };

  return (
    <div className="relative inline-block">
      <Button onClick={toggleMenu}>+ New</Button>

      {menuVisible && (
        <div
          className="absolute right-0 z-50 bg-white border rounded-xl mt-2"
          ref={menuRef}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex flex-col">
            <div className="flex items-center px-2 py-1 hover:bg-gray-100 rounded-t-xl">
              <img
                src="/image_folder_resource/add_folder.svg"
                alt="Rename"
                className="w-5 h-5"
              />
              <Button
                variant="menu"
                onClick={() => {
                  setMenuVisible(false);
                  openNewFolder();
                }}
              >
                New Folder
              </Button>
            </div>
            <div className="border-t" />
            <div className="flex items-center px-2 py-1 hover:bg-gray-100 rounded-b-xl">
              <img
                src="/image_folder_resource/upload_file.svg"
                alt="Delete"
                className="w-5 h-5"
              />
              <Button variant="menu" disabled={!canCreate}>File Upload</Button>
            </div>
          </div>
        </div>
      )}

      {/* Render the folder dialog outside the dropdown so it doesn't unmount with the menu */}
      <CreateFolderButton
        withTrigger={false}
        variant="menu"
        spaceId={spaceId}
        parentId={parentId}
      />
    </div>
  );
}
