import { createFileRoute } from "@tanstack/react-router";
import { DownloadExample } from "./download-example";

export const Route = createFileRoute("/download/")({
  component: RouteComponent,
});

function RouteComponent() {
  return <DownloadExample />;
}
