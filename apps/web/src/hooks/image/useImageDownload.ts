import app from "@/lib/fetch";

export const useImageDownload = () => {
  const downloadSingleImage = async (imageKey: string[]) => {
    const { data: downloadKeys, error: err } = await app.s3[
      "download-image-keys"
    ].post({
      keys: imageKey,
    });
    if (err) {
      alert(`Failed to download: ${err?.value || "Unknown download error"}`);
      return;
    }
    const k = downloadKeys.downloadKeys;
    const j = k ?? "";
    const encodedKey = encodeURIComponent(j[0]);
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
    const { data: downloadKeys, error } = await app.s3[
      "download-image-keys"
    ].post({
      keys: imageKeys,
    });
    if (error) {
      alert(`Failed to download: ${error?.value || "Unknown download error"}`);
      return;
    }
    const response = await fetch(
      `${process.env.API_BASE_URL ?? "http://localhost:20257"}/s3/batch-download`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ downloadKeys }),
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
  const handleDownload = async (keys: string[]) => {
    if (keys.length === 0) {
      alert("Please select at least one image.");
      return;
    }

    if (keys.length === 1) {
      await downloadSingleImage(keys);
    } else {
      await downloadMultipleImages(keys);
    }
  };

  return {
    downloadSingleImage,
    downloadMultipleImages,
    handleDownload,
  };
};
