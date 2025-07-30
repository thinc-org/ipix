import { useEffect, useRef, useState } from "react";
import { Button } from "../ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTrigger,
} from "../ui/dialog";
import { buttonVariants } from "../ui/button";
import type { VariantProps } from "class-variance-authority";
import { Pencil } from "lucide-react";

type ButtonVariant = VariantProps<typeof buttonVariants>["variant"];

export function UserAccountCard({
  variant,
  userInfo: initialUserInfo,
}: {
  variant?: ButtonVariant;
  userInfo: {
    email: string | undefined;
    name: string | undefined;
    imageProfile: string | undefined;
    role: string | undefined;
  };
}) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [userInfo, setUserInfo] = useState(initialUserInfo);
  const [tempName, setTempName] = useState(initialUserInfo.name);
  const [tempPreviewImage, setTempPreviewImage] = useState<string | undefined>(
    initialUserInfo.imageProfile
  );
  const tempPreviewImageUrlRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    setUserInfo(initialUserInfo);
    setTempName(initialUserInfo.name);
    setTempPreviewImage(initialUserInfo.imageProfile);
  }, [initialUserInfo]);

  const handleEnterEdit = () => {
    setTempName(userInfo.name);
    setTempPreviewImage(userInfo.imageProfile);
    setEditing(true);
  };

  const handleCancelEdit = () => {
    setTempName(userInfo.name);
    setTempPreviewImage(userInfo.imageProfile);
    setEditing(false);
  };

  const handleSaveChanges = () => {
    setUserInfo({
      ...userInfo,
      name: tempName,
      imageProfile: tempPreviewImage,
    });
    setEditing(false);
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (tempPreviewImageUrlRef.current) {
        URL.revokeObjectURL(tempPreviewImageUrlRef.current);
      }
      const previewUrl = URL.createObjectURL(file);
      tempPreviewImageUrlRef.current = previewUrl;
      setTempPreviewImage(previewUrl);
    }
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={variant}>Account</Button>
      </DialogTrigger>
      <DialogContent>
        <div className="flex flex-col items-center mt-4">
          <div className="relative w-20 h-20 mb-4">
            <img
              src={
                editing
                  ? tempPreviewImage || "/default-profile.png"
                  : userInfo.imageProfile || "/default-profile.png"
              }
              alt={userInfo.name || "User"}
              className={`w-full h-full rounded-full object-cover ${
                editing ? "cursor-pointer" : ""
              }`}
              onClick={() =>
                editing && document.getElementById("image-input")?.click()
              }
            />

            {editing && (
              <div className="absolute bottom-0 right-0 bg-white rounded-full p-1 shadow border-2">
                <Pencil className="w-4 h-4 text-gray-500" />
              </div>
            )}
          </div>

          <input
            id="image-input"
            type="file"
            accept="image/*"
            onChange={handleImageChange}
            className="hidden"
          />
        </div>
        <div className="mt-4">
          <div className="flex justify-between mb-4">
            <div className="text-lg w-1/2">Name</div>
            <div className="w-1/2 text-right">
              {editing ? (
                <input
                  type="text"
                  value={tempName || ""}
                  onChange={(e) => setTempName(e.target.value)}
                  className="text-lg text-gray-600 border border-gray-300 p-1 w-full"
                />
              ) : (
                <span className="text-lg text-gray-600">{userInfo.name}</span>
              )}
            </div>
          </div>
          <div className="flex justify-between mb-4">
            <div className="text-lg w-1/2">Role</div>
            <div className="text-lg text-gray-600 w-1/2 text-right">
              {userInfo.role}
            </div>
          </div>
          <div className="flex justify-between mb-4">
            <div className="text-lg w-1/2">Email</div>
            <div className="text-lg text-gray-600 w-1/2 text-right">
              {userInfo.email}
            </div>
          </div>
        </div>
        <div className="flex justify-end space-x-2 mt-4">
          {editing ? (
            <>
              <Button
                variant="ghost"
                className="text-black/50 text-sm"
                onClick={handleCancelEdit}
              >
                Cancel
              </Button>
              <Button
                variant="ghost"
                className="text-blue-500 text-sm"
                onClick={handleSaveChanges}
              >
                Save
              </Button>
            </>
          ) : (
            <>
              <DialogClose asChild>
                <Button variant="ghost" className="text-black/50 text-sm">
                  Close
                </Button>
              </DialogClose>
              <Button
                variant="ghost"
                className="text-blue-500 text-sm"
                onClick={handleEnterEdit}
              >
                Setting
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
