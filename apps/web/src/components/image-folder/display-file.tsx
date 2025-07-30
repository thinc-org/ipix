import type { FileType } from "@/utils/types/file";

type FileProps = {
  file: FileType;
};

export function DisplayFile({ file }: FileProps) {
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
    <div className="w-[184px] flex flex-col items-center p-2">
      <div className="w-[150px] h-[90px] bg-gray-100 overflow-hidden flex items-center justify-center">
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
