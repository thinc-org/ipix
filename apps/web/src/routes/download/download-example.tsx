import { useState } from "react";
import { ImageCard } from "@/components/example/image-card";
import { useImageBatchFetch } from "@/hooks/image/useImageBatchFetch";
import { useImageDownload } from "@/hooks/image/useImageDownload";

export function DownloadExample() {
  const [selectedImageKeys, setSelectedImageKeys] = useState<string[]>([]);
  const { data: images = [], isLoading, error } = useImageBatchFetch();
  const { downloadSingleImage, downloadMultipleImages } = useImageDownload();

  const toggleCheckbox = (key: string) =>
    setSelectedImageKeys((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );

  const handleDownload = async () => {
    if (selectedImageKeys.length === 0) {
      alert("Please select at least one image.");
      return;
    }

    if (selectedImageKeys.length === 1) {
      await downloadSingleImage(selectedImageKeys[0]);
    } else {
      await downloadMultipleImages(selectedImageKeys);
    }
  };

  if (isLoading) {
    return (
      <h1 className="flex flex-col items-center justify-center text-3xl min-h-screen p-5 font-bold mb-8 text-gray-800">
        Loading images...
      </h1>
    );
  }

  if (error) {
    return (
      <h1 className="flex flex-col items-center justify-center text-3xl min-h-screen p-5 font-bold mb-8 text-gray-800">
        Failed to load images
      </h1>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-5 box-border font-sans">
      <h1 className="text-3xl font-bold mb-8 text-gray-800">
        Image Downloader
      </h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        {images.length ? (
          images.map((img) => (
            <ImageCard
              key={img.key}
              image={img}
              selected={selectedImageKeys.includes(img.key)}
              onToggle={() => toggleCheckbox(img.key)}
            />
          ))
        ) : (
          <p className="text-xl text-gray-600 col-span-full text-center">
            No images available.
          </p>
        )}
      </div>

      {images.length > 0 && (
        <>
          <button
            onClick={handleDownload}
            disabled={selectedImageKeys.length === 0}
            className={`px-8 py-4 text-lg font-bold text-white rounded-lg cursor-pointer transition-colors duration-300 ease-in-out transform shadow-lg hover:shadow-xl active:scale-95 ${
              selectedImageKeys.length === 0
                ? "bg-gray-400 cursor-not-allowed"
                : "bg-green-500 hover:bg-green-600"
            }`}
          >
            {selectedImageKeys.length <= 1
              ? "Download Selected Image"
              : `Download ${selectedImageKeys.length} Images as Zip`}
          </button>
        </>
      )}
    </div>
  );
}
