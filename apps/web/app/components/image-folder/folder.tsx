import { useState, useRef, useEffect } from "react";
import { RenameFolderButton } from "./rename-folder-button";
import { DeleteFolderButton } from "./";
import { Link } from "react-router";
import { useOnClickOutside } from "usehooks-ts";

export function Folder({
  folderName,
  imageCount,
  folderId,
}: {
  folderName: string;
  imageCount: number;
  folderId: string;
}) {
  const [menuVisible, setMenuVisible] = useState(false);
  const folderRef = useRef<HTMLDivElement>(null);

  useOnClickOutside(folderRef as React.RefObject<HTMLElement>, () => {
    setMenuVisible(false);
  });

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setMenuVisible(true);
  };

  const menuStyle = {
    top: "70px",
    left: "100px",
    minWidth: "120px",
  };

  return (
    <div
      ref={folderRef}
      className="w-[184px] relative"
      onContextMenu={handleContextMenu}
    >
      <Link to={folderId} className="flex flex-col items-center p-2">
        <img src="/image_folder_resource/folder.svg" aria-hidden="true" />
        <span className="text-center text-xs">{folderName}</span>
        <span className="text-black/50 text-xs">
          Folder · {imageCount} Item(s)
        </span>
      </Link>

      {menuVisible && (
        <div
          className="absolute z-50 bg-white border rounded-xl"
          style={menuStyle}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex flex-col">
            <div className="flex items-center px-2 py-1 hover:bg-gray-100 rounded-t-xl">
              <img
                src="/image_folder_resource/edit_icon.svg"
                alt="Rename"
                className="w-5 h-5"
              />
              <RenameFolderButton variant="menu" />
            </div>
            <div className="border-t" />
            <div className="flex items-center px-2 py-1 hover:bg-gray-100 rounded-b-xl">
              <img
                src="/image_folder_resource/trash_icon.svg"
                alt="Delete"
                className="w-5 h-5"
              />
              <DeleteFolderButton variant="menu" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
