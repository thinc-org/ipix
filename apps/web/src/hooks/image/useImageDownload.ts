import app from "@/lib/fetch";

export const useImageDownload = () => {
  const downloadSingleImage = async (imageKey: string) => {
    const encodedKey = encodeURIComponent(imageKey);
    const { data, error } = await app.s3["image"]({
      imageKey: encodedKey,
    }).get({
      query: { download: "true" },
    });

    if (!data?.url || error) {
      alert(`Failed to download: ${error?.value || "Unknown download error"}`);
      return;
    }
    window.location.href = data.url;
  };

  const downloadMultipleImages = async (imageKeys: string[]) => {
    const response = await fetch(
      `${process.env.API_BASE_URL ?? "http://localhost:20257"}/s3/batch-download`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ imageKeys }),
      }
    );

    if (!response.ok) {
      const resJson = await response.json().catch(() => ({}));
      throw new Error(
        resJson.error || `${response.status} ${response.statusText}`
      );
    }

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "files.zip";
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return {
    downloadSingleImage,
    downloadMultipleImages,
  };
};
