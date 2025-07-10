import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";

type Role = "owner" | "can view" | "can edit";

type UserRole = "owner" | "everyone" | "people";

interface ShareUserItemProps {
  email: string;
  profile_link: string;
  role: Role;
  userType: UserRole;
  onChangeRole?: (newRole: Role) => void;
}

export function ShareUserItem({
  email,
  profile_link,
  role,
  userType,
  onChangeRole,
}: ShareUserItemProps) {
  return (
    <div className="flex items-center justify-start space-x-3 py-2">
      <img
        src={profile_link || ""}
        width={32}
        height={32}
        alt="Profile"
        className="rounded-lg"
      />
      <div>
        <div className="text-sm font-medium">
          {userType === "everyone" ? "Anyone with the link" : email}
        </div>
      </div>

      <div className="absolute right-5">
        {userType === "owner" ? (
          <Label className="text-muted-foreground text-sm">owner</Label>
        ) : (
          <Select
            value={role}
            onValueChange={(value: Role) => onChangeRole?.(value)}
          >
            <SelectTrigger className="w-[120px]">
              <SelectValue placeholder="Select role" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="can view">can view</SelectItem>
              <SelectItem value="can edit">can edit</SelectItem>
            </SelectContent>
          </Select>
        )}
      </div>
    </div>
  );
}
