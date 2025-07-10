import { useState } from "react";
import { Ghost, Link } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";

export function DialogShare() {
  const folder_name = "ค่ายวิษณุกรรมบุตร ครั้งที่ 22";
  const [inputValue, setInputValue] = useState("");
  const [open, setOpen] = useState(false);

  const handleCancel = () => {
    setInputValue("");
    setOpen(false);
  };

  const handleSubmit = () => {
    console.log("Input data:", inputValue);
    setOpen(false);
  };

  const handleOpenChange = (isOpen: boolean) => {
    if (isOpen) {
      setInputValue("");
    }
    setOpen(isOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline">Shrare With Me</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex justify-between">
            <p>Shared "{folder_name}"</p>
            <button className="text-blue-500 text-xs mr-4 flex flex-row items-center space-x-1">
              <Link size={17} />
              <p>Copy Link</p>
            </button>
          </DialogTitle>
        </DialogHeader>

        <div className="py-4 flex flex-row space-x-2">
          <Input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Add people with E-mail"
            className="w-full bg-gray-50"
          />
          <Button variant="ghost" className="bg-gray-50">
            Add
          </Button>
        </div>

        <p className="text-gray-600 text-sm">Who can access</p>
        <div className="flex justify-end space-x-2 mt-4"></div>
      </DialogContent>
    </Dialog>
  );
}
