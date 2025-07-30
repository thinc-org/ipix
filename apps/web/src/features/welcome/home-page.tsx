import { Header } from "@/components/base-component/header";
import { Sidebar } from "@/components/base-component/sidebar";
import { CreateFolderButton } from "@/components/image-folder";
import { DisplayFile } from "@/components/image-folder/display-file";
import { Folder } from "@/components/image-folder/folder";
import { mockFiles, mockFolders } from "@/utils/mock/mock";

export function HomePage() {
  return (
    <div className="min-h-screen bg-background relative">
      <Header />
      <Sidebar />

      <div className="absolute top-[10vh] right-0 w-[80vw] px-8">
        <div className="flex justify-end p-8">
          <CreateFolderButton />
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
