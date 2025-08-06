import { useQuery } from "@tanstack/react-query";
import app from "@/lib/fetch";

export function useBatchImageKeys() {
  return useQuery({
    queryKey: ["batch-image-keys"],
    queryFn: async () => {
      try {
        const imageKeysToLoad = [
          "uploads/2025-07-27/84038e70-64f1-4c0a-a160-dca456fc3dec-Screenshot 2024-11-06 200335.png",
          "uploads/2025-07-24/002aaf1f-b5a3-4fc9-891a-801e6e898a3b-Screenshot 2024-07-28 220302.png",
        ];

        const encodedKeys = imageKeysToLoad.map(encodeURIComponent);
        const { data } = await app.s3["batch-image"].post(
          { keys: encodedKeys },
          { fetch: { credentials: "include" } }
        );

        return (
          data?.signedUrls.map((item: any) =>
            item.error
              ? { key: item.key, displayUrl: undefined, error: item.error }
              : { key: item.key, displayUrl: item.url }
          ) ?? []
        );
      } catch (error) {
        throw new Error("Failed to fetch image");
      }
    },
  });
}
