import { useState } from "react";
import { Link } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ShareUserItem } from "./list-share-email";

export function DialogShare() {
  const folder_name = "ค่ายวิษณุกรรมบุตร ครั้งที่ 22";
  const [inputValue, setInputValue] = useState("");
  const [open, setOpen] = useState(false);
  const [mockUsers, setMockData] = useState([
    {
      email: "Anyone with the link",
      role: "can view",
      userType: "everyone",
      profile_link: "https://i.pravatar.cc/150?u=anyone",
    },
    {
      email: "thinc.co@gmail.com",
      role: "owner",
      userType: "owner",
      profile_link: "https://i.pravatar.cc/150?u=thinc.co@gmail.com",
    },
    {
      email: "member1@gmail.com",
      role: "can edit",
      userType: "people",
      profile_link: "https://i.pravatar.cc/150?u=member1@gmail.com",
    },
    {
      email: "member2@gmail.com",
      role: "can edit",
      userType: "people",
      profile_link: "https://i.pravatar.cc/150?u=member2@gmail.com",
    },
    {
      email: "member3@gmail.com",
      role: "can edit",
      userType: "people",
      profile_link: "https://i.pravatar.cc/150?u=member3@gmail.com",
    },
    {
      email: "member4@gmail.com",
      role: "can edit",
      userType: "people",
      profile_link: "https://i.pravatar.cc/150?u=member4@gmail.com",
    },
    {
      email: "member5@gmail.com",
      role: "can edit",
      userType: "people",
      profile_link: "https://i.pravatar.cc/150?u=member5@gmail.com",
    },
  ]);

  const handleRoleChange = (index: number, newRole: any) => {
    const updated = [...mockUsers];
    updated[index].role = newRole;
    setMockData(updated);
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
        <div className="space-y-2 p-4">
          {mockUsers.map((user, i) => (
            <ShareUserItem
              key={user.email}
              email={user.email}
              profile_link={user.profile_link}
              role={user.role as any}
              userType={user.userType as any}
              onChangeRole={(role) => handleRoleChange(i, role)}
            />
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
