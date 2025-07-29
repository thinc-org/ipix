import { createFileRoute } from "@tanstack/react-router";
import app from "@/lib/fetch";
import { DownloadExample } from "./download-example";

interface ImageData {
  key: string;
  displayUrl?: string;
  error?: string;
}

export const Route = createFileRoute("/download/")({
  loader: async () => {
    //tmp image key
    const imageKeysToLoad = [
      "uploads/2025-07-27/84038e70-64f1-4c0a-a160-dca456fc3dec-Screenshot 2024-11-06 200335.png",
      "uploads/2025-07-24/002aaf1f-b5a3-4fc9-891a-801e6e898a3b-Screenshot 2024-07-28 220302.png",
    ];

    const encodedKeys = imageKeysToLoad.map(encodeURIComponent);

    const { data, error } = await app.s3["batch-image"].post({
      keys: encodedKeys,
    });

    const images =
      data?.signedUrls.map((item: any) => {
        if (item.error) {
          return {
            key: item.key,
            displayUrl: undefined,
            error: `Error for ${item.key}: ${item.error}`,
          };
        }
        return { key: item.key, displayUrl: item.url };
      }) || [];

    return { images };
  },
  component: RouteComponent,
});

function RouteComponent() {
  const { images } = Route.useLoaderData() as { images: ImageData[] };
  return <DownloadExample images={images} />;
}
