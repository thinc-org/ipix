import { useRef, useState, useMemo } from "react";
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
import { createFolderMutation } from "@/features/item/hook";
import { useTransferStore } from "@/stores/fileStores";

type ButtonVariant = VariantProps<typeof buttonVariants>["variant"];

export function CreateFolderButton({
  variant,
  spaceId,
  parentId,
  withTrigger = true,
}: {
  variant?: ButtonVariant;
  spaceId: string;
  parentId?: string;
  withTrigger?: boolean;
}) {
  const inputFolderName = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("");
  const open = useTransferStore((s) => s.ui.newFolderOpen);
  const openDialog = useTransferStore((s) => s.openNewFolder);
  const closeDialog = useTransferStore((s) => s.closeNewFolder);

  // Allow creating at root (no parentId) by sending null to API
  const canCreate = useMemo(() => Boolean(spaceId), [spaceId]);
  const mutation = createFolderMutation();

  const createFolder = () => {
    const folderName = name.trim();
    if (!canCreate || !folderName) return;
    mutation.mutate(
      { spaceId, name: folderName, parentId: parentId ?? null },
      {
        onSuccess: () => {
          // clear field; dialog will be closed by mutation's onSuccess in hook.ts
          setName("");
          if (inputFolderName.current) inputFolderName.current.value = "";
        },
      }
    );
  };
  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (v) openDialog();
        else {
          closeDialog();
          // reset input when closed
          setName("");
          if (inputFolderName.current) inputFolderName.current.value = "";
        }
      }}
    >
      {withTrigger && (
        <DialogTrigger asChild>
          <Button variant={variant} disabled={!canCreate}>
            New Folder
          </Button>
        </DialogTrigger>
      )}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New Folder</DialogTitle>
          <input
            ref={inputFolderName}
            type="text"
            className="gap-10 p-2 rounded-md border-[0.5px] border-black mt-8"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                createFolder();
              }
            }}
            autoFocus
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
            disabled={!canCreate || !name.trim() || mutation.isPending}
          >
            {mutation.isPending ? "Creating…" : "Create"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
