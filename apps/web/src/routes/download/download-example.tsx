import { useState } from "react";
import app from "@/lib/fetch";
import { ImageCard } from "@/components/example/image-card";

interface ImageData {
  key: string;
  displayUrl?: string;
  error?: string;
}

interface Props {
  images: ImageData[];
}

const API_BASE_URL = process.env.API_BASE_URL ?? "http://localhost:20257";

if (!API_BASE_URL) {
  throw new Error("API_BASE_URL is required but not defined");
}

export function DownloadExample({ images }: Props) {
  const [selectedImageKeys, setSelectedImageKeys] = useState<string[]>([]);

  const toggleCheckbox = (key: string) => {
    setSelectedImageKeys((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const handleDownload = async () => {
    if (selectedImageKeys.length === 0) {
      alert("Please select at least one image.");
      return;
    }

    if (selectedImageKeys.length === 1) {
      const imageKey = selectedImageKeys[0];
      try {
        const encodedKey = encodeURIComponent(imageKey);
        const { data, error } = await app.s3["image"]({
          imageKey: encodedKey,
        }).get({
          query: { download: "true" },
        });

        if (!data?.url || error) {
          alert(
            `Failed to download: ${error?.value || "Unknown download error"}`
          );
          return;
        }

        window.location.href = data.url;
      } catch (err) {
        alert("Error downloading the image.");
      }
    } else {
      try {
        const response = await fetch(`${API_BASE_URL}/s3/batch-download`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            imageKeys: selectedImageKeys,
          }),
        });

        if (!response.ok) {
          let errorMsg = `HTTP Error: ${response.status}`;
          try {
            const resJson = await response.json();
            errorMsg = resJson.error || JSON.stringify(resJson);
          } catch {
            errorMsg = `${errorMsg} ${response.statusText}`;
          }
          throw new Error(errorMsg);
        }

        const blob = await response.blob();

        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "files.zip";
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
      } catch (err: any) {
        alert(
          `An error occurred while downloading multiple files: ${err.message}`
        );
      }
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-5 box-border font-sans">
      <h1 className="text-3xl font-bold mb-8 text-gray-800">
        Image Downloader
      </h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        {images.length > 0 ? (
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
        <button
          onClick={handleDownload}
          disabled={selectedImageKeys.length === 0}
          className={`px-8 py-4 text-lg font-bold text-white rounded-lg cursor-pointer
                      transition-colors duration-300 ease-in-out transform
                      shadow-lg hover:shadow-xl active:scale-95
                      ${
                        selectedImageKeys.length === 0
                          ? "bg-gray-400 cursor-not-allowed"
                          : "bg-green-500 hover:bg-green-600"
                      }`}
        >
          {selectedImageKeys.length <= 1
            ? "Download Selected Image"
            : `Download ${selectedImageKeys.length} Images as Zip`}
        </button>
      )}
    </div>
  );
}
