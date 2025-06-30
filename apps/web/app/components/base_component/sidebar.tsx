import { useState } from "react";
import { Button } from "~/components/ui/button";
import { Progress } from "~/components/ui/progress";
import { Avatar, AvatarImage, AvatarFallback } from "~/components/ui/avatar";
import { cn } from "~/lib/utils";
import { Menu } from "lucide-react";
import { Link } from "react-router";
import { Image, Users } from "lucide-react";

const user = {
  profilePictureLink: "https://i.pravatar.cc/100",
  email: "thinc.co@gmail.com",
  storageSpaceUsed: 700,
  storageSpaceAll: 1000,
};

export function Sidebar() {
  const [open, setOpen] = useState(true);

  const percentage = Math.floor(
    (user.storageSpaceUsed / user.storageSpaceAll) * 100
  );

  return (
    <div className="fixed top-[10vh] h-[90vh] z-50 text-lg">
      <Button
        variant="ghost"
        onClick={() => setOpen(!open)}
        className="absolute top-4 -right-15 z-50"
      >
        <Menu />
      </Button>

      <aside
        className={cn(
          "bg-white dark:bg-neutral-800 border-r shadow-sm transition-all  h-full overflow-y-auto",
          open ? "w-[70vw] md:w-[20vw]" : "w-0"
        )}
      >
        {open && (
          <div className="p-4 flex flex-col justify-between h-full">
            <div>
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                  <Avatar>
                    <AvatarImage src={user.profilePictureLink} />
                    <AvatarFallback>U</AvatarFallback>
                  </Avatar>
                  <div>{user.email}</div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-gray-500 cursor-pointer"
                >
                  Log Out
                </Button>
              </div>

              <nav className="space-y-2">
                <Link
                  to="/myipix"
                  className="flex flex-row space-x-5 items-center justify-start w-full px-4 py-2 rounded-md hover:bg-muted transition"
                >
                  <Image /> <p>My IPix</p>
                </Link>
                <Link
                  to="/sharewithme"
                  className="flex flex-row space-x-5 items-center justify-start w-full px-4 py-2 rounded-md hover:bg-muted transition"
                >
                  <Users /> <p>Shared With Me</p>
                </Link>
              </nav>
            </div>

            <div className="p-4 h-32 flex justify-between  flex-col border rounded-md">
              <p className="text-xl font-semibold mb-1">Storage Space</p>
              <Progress value={percentage} />
              <p className="text-sm text-muted-foreground mt-1">
                {user.storageSpaceUsed} GB of {user.storageSpaceAll} TB used (
                {percentage}%)
              </p>
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}
