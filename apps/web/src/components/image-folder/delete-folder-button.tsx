import { useState } from "react";
import { Button } from "../ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../ui/dialog";
import { buttonVariants } from "../ui/button";
import type { VariantProps } from "class-variance-authority";

type ButtonVariant = VariantProps<typeof buttonVariants>["variant"];

export function DeleteFolderButton({ variant }: { variant?: ButtonVariant }) {
  const [open, setOpen] = useState(false);
  const deleteFolder = () => {
    //delete folder
    console.log("Folder deleted");
    setOpen(false);
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={variant}>Delete</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete Confirmation</DialogTitle>
          <DialogDescription className="mt-4">
            Are you sure you want to delete this folder? This action cannot be
            undone.
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-end space-x-2 mt-4">
          <DialogClose asChild>
            <Button variant="ghost" className="text-black/50 text-sm">
              Cancel
            </Button>
          </DialogClose>
          <Button variant="destructive" onClick={deleteFolder}>
            Delete
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
