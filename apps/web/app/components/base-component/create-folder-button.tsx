import { useRef, useState } from "react";
import { Button } from "../ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../ui/dialog";

export function CreateFolderButton() {
  const inputFolderName = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const createFolder = () => {
    const folderName = inputFolderName.current?.value || "";
    //create folder
    if (folderName) {
      console.log(`Folder Name: ${folderName}`);
      setOpen(false);
    }
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>+ New</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New Folder</DialogTitle>
          <input
            ref={inputFolderName}
            type="text"
            className="gap-10 p-2 rounded-md border-[0.5px] border-black mt-8"
          />
        </DialogHeader>
        <div className="flex justify-end space-x-2 mt-4 gap-4">
          <DialogClose asChild>
            <button className="bg-transparent text-black/50 text-sm">
              Cancel
            </button>
          </DialogClose>
          <button
            className="bg-transparent text-blue-500 text-sm"
            onClick={createFolder}
          >
            Create
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
