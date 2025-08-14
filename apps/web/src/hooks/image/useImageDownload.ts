import app from "@/lib/fetch";

export const useImageDownload = () => {
  const downloadSingleImage = async (spaceId: string, itemId: string) => {
    const { data, error } = await app.v1.spaces({spaceId}).items({itemId}).download.get({query: {download: true}})

    if (!data?.url || error) {
      alert(`Failed to download: ${error?.value || "Unknown download error"}`);
      return;
    }
    window.location.href = data.url;
  };

  // Trigger a download without navigating the page by clicking a temporary anchor.
  const triggerDownload = (url: string, filename?: string) => {
    const a = document.createElement("a");
    a.href = url;
    if (filename) a.download = filename; // let server's Content-Disposition decide if not provided
    a.rel = "noreferrer noopener";
    // Don't set target to avoid popups; browsers will handle attachment downloads inline
    document.body.appendChild(a);
    a.click();
    // Clean up
    document.body.removeChild(a);
  };

  const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms));

  // Download multiple images by requesting presigned URLs and triggering downloads sequentially.
  const downloadMultipleImages = async (
    spaceId: string,
    itemIds: string[],
    opts?: { delayMs?: number }
  ) => {
    const delay = opts?.delayMs ?? 300;
    for (const itemId of itemIds) {
      try {
        const { data, error } = await app.v1
          .spaces({ spaceId })
          .items({ itemId })
          .download.get({ query: { download: true } });

        if (!data?.url || error) {
          console.error("Failed to get download URL", { itemId, error });
          continue;
        }

        // Let server-provided Content-Disposition set filename; download attr is optional
        triggerDownload(data.url);
        if (delay > 0) await sleep(delay);
      } catch (e) {
        console.error("Error downloading item", { itemId, e });
      }
    }
  };

  const handleDownload = async (spaceId: string, itemIds: string[]) => {
    if (itemIds.length === 0) {
      alert("Please select at least one image.");
      return;
    }

    if (itemIds.length === 1) {
      await downloadSingleImage(spaceId, itemIds[0]);
      return;
    }
    await downloadMultipleImages(spaceId, itemIds);
  };

  return {
    downloadSingleImage,
    downloadMultipleImages,
    handleDownload,
  };
};
