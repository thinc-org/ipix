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
import { buttonVariants } from "../ui/button";
import type { VariantProps } from "class-variance-authority";

type ButtonVariant = VariantProps<typeof buttonVariants>["variant"];

export function CreateFolderButton({ variant }: { variant?: ButtonVariant }) {
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
        <Button variant={variant}>+ New</Button>
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
        <div className="flex justify-end space-x-2 mt-4">
          <DialogClose asChild>
            <Button variant="ghost" className="text-black/50 text-sm">
              Cancel
            </Button>
          </DialogClose>
          <Button
            variant="ghost"
            className="text-blue-500 text-sm"
            onClick={createFolder}
          >
            Create
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
