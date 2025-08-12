import { Header } from "@/components/base-component/header";
import { Sidebar } from "@/components/base-component/sidebar";
import { useAuth } from "@/lib/better-auth/auth-hooks";
import { FileToolBar } from "@/components/image-folder/file-tool-bar";
import { ImageGallery } from "@/components/image-folder/image-gallery";
import { useImageSelection } from "@/hooks/image/useImageSelection";
import { useIsAssociatedWithSpace } from "@/features/space/hook";
import { useItemsByFolder } from "@/features/item/hook";

export function SpacePage({
  spaceInfo,
}: {
  spaceInfo: {
    spaceId: string;
    folderId: string;
  };
}) {
  const { session } = useAuth();

  const userInfo = {
    email: session?.user.email ?? undefined,
    name: session?.user.name ?? undefined,
    imageProfile: session?.user.image ?? undefined,
    role: "Admin",
  };

  const { isSelectable, selectedImageKeys, toggleSelectable, toggleCheckbox } =
    useImageSelection();

  // Items within the effective folder
  const itemsQuery = useItemsByFolder({
    spaceId: spaceInfo.spaceId,
    folderId: spaceInfo.folderId,
  });

  return (
    <div className="min-h-screen bg-background relative">
      <Header />
      <Sidebar
        userInfo={{
          email: userInfo.email,
          imageProfile: userInfo.imageProfile,
        }}
      />
      <div className="flex-1 px-8 py-[10vh]">
        <FileToolBar
          isSelectable={isSelectable}
          selectedCount={selectedImageKeys.length}
          selectedImageKeys={selectedImageKeys}
          spaceInfo={{
            spaceId: spaceInfo.spaceId,
            folderId: spaceInfo.folderId,
          }}
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
          itemsQuery={itemsQuery}
        />
      </div>
    </div>
  );
}
