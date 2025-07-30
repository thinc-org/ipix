import { Header } from "@/components/base-component/header";
import { Sidebar } from "@/components/base-component/sidebar";
import { CreateFolderButton } from "@/components/image-folder";
import { DisplayFile } from "@/components/image-folder/display-file";
import { Folder } from "@/components/image-folder/folder";
import { mockFiles, mockFolders } from "@/utils/mock/mock";
import { useAuth } from "@/lib/better-auth/auth-hooks";
import { AddNewButton } from "@/components/image-folder/add-new-button";

export function HomePage() {
  const { session } = useAuth();
  const userInfo = {
    email: session?.user.email ?? undefined,
    name: session?.user.name ?? undefined,
    imageProfile: session?.user.image ?? undefined,
    role: "Admin",
  };
  return (
    <div className="min-h-screen bg-background relative">
      <Header />
      <Sidebar
        userInfo={{
          email: userInfo.email,
          imageProfile: userInfo.imageProfile,
        }}
      />

      <div className="absolute top-[10vh] right-0 w-[80vw] px-8">
        <div className="flex justify-end py-8">
          <AddNewButton />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6 gap-x-16">
          {mockFolders.map((folder) => (
            <Folder key={folder.id} folder={folder} />
          ))}
          {mockFiles.map((file) => (
            <DisplayFile
              key={file.id}
              file={{ ...file, uploadDate: new Date() }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
