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

export function DeleteFolderButton({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const deleteFolder = () => {
    //delete folder
    console.log("Folder deleted");
    setOpen(false);
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button {...(className ? { className } : { variant: "destructive" })}>
          Delete
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete Confirmation</DialogTitle>
          <DialogDescription className="mt-4">
            Are you sure you want to delete this folder? This action cannot be
            undone.
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-end space-x-2 mt-4 gap-4">
          <DialogClose asChild>
            <button className="bg-transparent text-black/50 text-sm">
              Cancel
            </button>
          </DialogClose>
          <Button variant="destructive" onClick={deleteFolder}>
            Delete
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
