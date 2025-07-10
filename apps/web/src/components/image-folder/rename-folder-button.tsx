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

export function RenameFolderButton({ variant }: { variant?: ButtonVariant }) {
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
        <Button variant={variant}>Rename</Button>
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
        <div className="flex justify-end space-x-2 mt-4">
          <DialogClose asChild>
            <Button variant="ghost" className="text-black/50 text-sm">
              Cancel
            </Button>
          </DialogClose>
          <Button
            variant="ghost"
            className="text-blue-500 text-sm"
            onClick={renameFolder}
          >
            Save
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
