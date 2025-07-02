export function Folder({
  folderName,
  imageCount,
}: {
  folderName: string;
  imageCount: number;
}) {
  return (
    <div className="w-[184px] flex flex-col items-center p-2">
      <img src="/base_resource/folder.svg" alt="Folder icon" />
      <span className="text-center text-xs">{folderName}</span>
      <span className="text-black/50 text-xs">
        Folder · {imageCount} Item(s)
      </span>
    </div>
  );
}
