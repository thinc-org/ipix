import { useQuery } from "@tanstack/react-query";
import app from "@/lib/fetch";

export function useImageBatchFetch() {
  return useQuery({
    queryKey: ["batch-image-keys"],
    queryFn: async () => {
      try {
        const { data: imageData, error } =
          await app.s3["preview-image-keys"].get();
        if (error) {
          throw new Error("Failed to fetch image keys");
        }
        const imageKeysToFetch = imageData.imageKeys ?? [];
        const { data: imageURLToFetch } = await app.s3["batch-image"].post(
          { keys: imageKeysToFetch },
          { fetch: { credentials: "include" } }
        );

        return (
          imageURLToFetch?.signedUrls.map((item: any) =>
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
