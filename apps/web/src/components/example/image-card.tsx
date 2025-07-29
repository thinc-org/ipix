import React from "react";

interface ImageData {
  key: string;
  displayUrl?: string;
  error?: string;
}

interface ImageCardProps {
  image: ImageData;
  selected: boolean;
  onToggle: () => void;
}

export function ImageCard({ image, selected, onToggle }: ImageCardProps) {
  const fileName = decodeURIComponent(image.key).split("/").pop();

  return (
    <div className="border border-gray-300 rounded-lg shadow-md p-4 flex flex-col items-center">
      <input
        type="checkbox"
        id={`checkbox-${image.key}`}
        checked={selected}
        onChange={onToggle}
        className="mb-3 w-5 h-5 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
      />
      <label htmlFor={`checkbox-${image.key}`} className="sr-only">
        Select {fileName}
      </label>

      {image.displayUrl ? (
        <img
          src={image.displayUrl}
          alt={`Preview of ${fileName}`}
          className="max-w-full max-h-48 object-contain rounded-md mb-3"
        />
      ) : (
        <div className="w-full h-48 bg-gray-200 flex items-center justify-center rounded-md mb-3 text-gray-500">
          No preview available
        </div>
      )}
    </div>
  );
}
