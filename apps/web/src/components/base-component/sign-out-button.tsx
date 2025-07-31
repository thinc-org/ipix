// components/shared/LogoutButton.tsx

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
import { useAuth } from "@/lib/better-auth/auth-hooks";

export function SignOutButton() {
  const [open, setOpen] = useState(false);
  const { signOut } = useAuth();

  const handleLogout = () => {
    signOut();
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="text-gray-500 max-sm:text-xs p-0"
        >
          Log Out
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Log out confirmation</DialogTitle>
          <DialogDescription className="mt-4">
            Are you sure you want to log out?
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-end space-x-2 mt-4">
          <DialogClose asChild>
            <Button variant="ghost" className="text-black/50 text-sm">
              Cancel
            </Button>
          </DialogClose>
          <Button variant="destructive" onClick={handleLogout}>
            Log Out
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
