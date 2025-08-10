import { use, useState } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { ChevronDown, Menu } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Image, Users } from "lucide-react";
import { SignOutButton } from "./sign-out-button";
import { useAssociatedSpace } from "@/features/space/hook";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";

const user = {
  profilePictureLink: "https://i.pravatar.cc/100",
  email: "thinc.co@gmail.com",
  storageSpaceUsed: 700,
  storageSpaceAll: 1000,
};

export function Sidebar({
  userInfo,
}: {
  userInfo: {
    email: string | undefined;
    imageProfile: string | undefined;
  };
}) {
  const [open, setOpen] = useState(true);

  const percentage = Math.floor(
    (user.storageSpaceUsed / user.storageSpaceAll) * 100
  );
  const { data } = useAssociatedSpace();
  const spaces = data?.data?.data.mySpace ?? [];

  return (
    <div className="fixed top-[10vh] h-[90vh] z-50 text-lg">
      <Button
        variant="ghost"
        onClick={() => setOpen(!open)}
        className="absolute top-4 -right-12 border-2 z-50 md:hidden"
      >
        <Menu />
      </Button>

      <aside
        className={cn(
          "bg-white dark:bg-neutral-800 border-r shadow-sm transition-all  h-full overflow-y-auto",
          open ? "w-[80vw] md:w-[20vw]" : "w-0"
        )}
      >
        {open && (
          <div className="p-4 flex flex-col justify-between h-full">
            <div>
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-0.5 sm:gap-2">
                  <Avatar className="max-sm:h-8 max-sm:w-8">
                    <AvatarImage src={userInfo.imageProfile} />
                    <AvatarFallback>U</AvatarFallback>
                  </Avatar>
                  <div className="max-sm:text-sm">
                    {userInfo.email ?? (
                      <span className="inline-block h-4 w-28 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
                    )}
                  </div>
                </div>
                <SignOutButton />
              </div>

              <nav className="space-y-2">
                <Link
                  to="/myipix"
                  className="flex flex-row space-x-5 items-center justify-start w-full px-4 py-2 rounded-md hover:bg-muted transition"
                >
                  <Image /> <p>My IPix</p>
                </Link>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="flex flex-row items-center justify-between w-full px-4 py-2 rounded-md hover:bg-muted transition">
                      <span className="flex items-center gap-5">
                        <Users /> Shared With Me
                      </span>
                      <ChevronDown className="h-4 w-4" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-56">
                    {spaces.length > 0 ? (
                      spaces.map((space) => (
                        <DropdownMenuItem key={space.id} asChild>
                          <Link
                            to={`/space/$spaceId`}
                            params={{ spaceId: space.id }}
                          >
                            {space.name}
                          </Link>
                        </DropdownMenuItem>
                      ))
                    ) : (
                      <DropdownMenuItem disabled>
                        No spaces found
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </nav>
            </div>

            <div className="p-4 h-32 flex justify-between  flex-col border rounded-md">
              <p className="text-xl font-semibold mb-1">Storage Space</p>
              <Progress value={percentage} />
              <p className="text-sm text-muted-foreground mt-1">
                {user.storageSpaceUsed} GB of {user.storageSpaceAll} GB used (
                {percentage}%)
              </p>
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}
