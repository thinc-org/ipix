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

export function RenameFolderButton({ className }: { className?: string }) {
  const inputNewFolderName = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const renameFolder = () => {
    const newFolderName = inputNewFolderName.current?.value || "";
    if (newFolderName) {
      console.log(`Folder Name: ${newFolderName}`);
      setOpen(false);
    }
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {className ? (
          <button className={className}>Rename</button>
        ) : (
          <Button>Rename</Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rename</DialogTitle>
          <input
            ref={inputNewFolderName}
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
            onClick={renameFolder}
          >
            Save
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
