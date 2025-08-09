import { Header } from "@/components/base-component/header";
import { Sidebar } from "@/components/base-component/sidebar";
import { ImageGallery } from "@/components/image-folder/image-gallery";
import { useAuth } from "@/lib/better-auth/auth-hooks";
import { useImageSelection } from "@/hooks/image/useImageSelection";
import { FileToolBar } from "@/components/image-folder/file-tool-bar";

export function HomePage() {
  const { session } = useAuth();
  const { isSelectable, selectedImageKeys, toggleSelectable, toggleCheckbox } =
    useImageSelection();

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />
      <div className="flex flex-1 gap-2">
        <Sidebar
          userInfo={{
            email: session?.user.email ?? undefined,
            imageProfile: session?.user.image ?? undefined,
          }}
        />

        <div className="flex-1 px-8 py-[10vh]">
          <FileToolBar
            isSelectable={isSelectable}
            selectedCount={selectedImageKeys.length}
            selectedImageKeys={selectedImageKeys}
            onCancel={toggleSelectable}
            onDelete={() => {
              console.log("delete");
            }}
            onToggleSelect={toggleSelectable}
          />

          <ImageGallery
            isSelectable={isSelectable}
            selectedImageKeys={selectedImageKeys}
            onToggleCheckbox={toggleCheckbox}
          />
        </div>
      </div>
    </div>
  );
}
