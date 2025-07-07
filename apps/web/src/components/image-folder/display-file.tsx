export function DisplayFile({
  imageSrc,
  imageName,
  uploadDate,
}: {
  imageSrc: string;
  imageName: string;
  uploadDate: Date;
}) {
  const formattedDate = `${uploadDate.getDate()} ${uploadDate.toLocaleString(
    "en-US",
    {
      month: "short",
    },
  )} ${uploadDate.getFullYear()} · ${uploadDate.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })}`;
  return (
    <div className="w-[184px] flex flex-col items-center p-2">
      <img src={imageSrc} alt={imageName} />
      <span className="text-center text-xs">{imageName}</span>
      <span className="text-black/50 text-xs">{formattedDate}</span>
    </div>
  );
}
