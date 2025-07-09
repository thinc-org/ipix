import { useState } from "react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";

export function DialogRename() {
  const place_holder_data = "รวบรวมภาพถ่าย";
  const [inputValue, setInputValue] = useState(place_holder_data);
  const [open, setOpen] = useState(false);

  const handleCancel = () => {
    setInputValue(place_holder_data);
    setOpen(false);
  };

  const handleSubmit = () => {
    console.log("Input data:", inputValue);
    setOpen(false);
  };

  const handleOpenChange = (isOpen: boolean) => {
    if (isOpen) {
      setInputValue(place_holder_data);
    }
    setOpen(isOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline">Rename</Button>
      </DialogTrigger>
      <DialogContent className="[&>button]:hidden">
        <DialogHeader>
          <DialogTitle>Rename</DialogTitle>
        </DialogHeader>

        <div className="py-4">
          <Input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder={place_holder_data}
            className="w-full"
          />
        </div>

        <div className="flex justify-end space-x-2 mt-4">
          <Button
            variant="link"
            className="text-gray-400 cursor-pointer hover:no-underline hover:bg-slate-100"
            onClick={handleCancel}
          >
            Cancel
          </Button>
          <Button
            variant="link"
            className="text-blue-600 cursor-pointer hover:no-underline hover:bg-slate-100"
            onClick={handleSubmit}
          >
            Save
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
