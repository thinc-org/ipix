import { DisplayFile } from "@/components/image-folder/display-file";
import { useImageBatchFetch } from "@/hooks/image/useImageBatchFetch";

interface ImageGalleryProps {
  isSelectable: boolean;
  selectedImageKeys: string[];
  onToggleCheckbox: (key: string) => void;
}

export function ImageGallery({
  isSelectable,
  selectedImageKeys,
  onToggleCheckbox,
}: ImageGalleryProps) {
  const { data: images = [], isLoading, error } = useImageBatchFetch();

  if (isLoading) {
    return (
      <h1 className="flex flex-col items-center text-3xl min-h-screen p-5 font-bold mb-8 text-gray-800 pl-[20vw]">
        Loading images...
      </h1>
    );
  }

  if (error) {
    return (
      <h1 className="flex flex-col items-center text-3xl min-h-screen font-bold mb-8 text-gray-800 pl-[20vw]">
        Failed to load images
      </h1>
    );
  }

  return (
    <div className="flex flex-col items-center min-h-screen box-border font-sans pl-[20vw]">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6 mb-8">
        {images.length ? (
          images.map((img) => (
            <DisplayFile
              key={img.key}
              file={{
                id: img.key,
                name: img.key || "Untitled",
                url: img.displayUrl,
                uploadDate: new Date(),
                parent: img.key,
                size: "1",
              }}
              selectable={isSelectable}
              selected={selectedImageKeys.includes(img.key)}
              onToggle={() => onToggleCheckbox(img.key)}
            />
          ))
        ) : (
          <div className="text-xl text-gray-600 col-span-full text-center">
            No images available.
          </div>
        )}
      </div>
    </div>
  );
}
