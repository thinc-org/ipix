import type { FileType } from "@/utils/types/file";
import { Input } from "../ui/input";

type FileProps = {
  file: FileType;
  selectable: boolean;
  selected: boolean;
  onToggle: () => void;
};

export function DisplayFile({
  file,
  selectable,
  selected,
  onToggle,
}: FileProps) {
  const formattedDate = `${file.uploadDate.getDate()} ${file.uploadDate.toLocaleString(
    "en-US",
    {
      month: "short",
    }
  )} ${file.uploadDate.getFullYear()} · ${file.uploadDate.toLocaleTimeString(
    "en-GB",
    {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }
  )}`;

  return (
    <div
      className={`w-[184px] flex flex-col items-center p-2 relative rounded-md transition-colors ${
        selected ? "bg-gray-100" : ""
      }`}
    >
      {selectable && (
        <Input
          type="checkbox"
          checked={selected}
          onChange={onToggle}
          className="absolute top-2 right-4 z-10 h-5 w-5 accent-black"
        />
      )}

      <div className="w-[150px] h-[90px] overflow-hidden flex items-center justify-center">
        <img
          src={file.url}
          alt={file.name}
          className="w-full h-full object-contain"
        />
      </div>
      <span className="text-center text-xs mt-1">{file.name}</span>
      <span className="text-black/50 text-xs">{formattedDate}</span>
    </div>
  );
}
