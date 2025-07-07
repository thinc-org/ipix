import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/myipix/")({
  component: RouteComponent,
});

function RouteComponent() {
  return <div>Hello "/myipix/"!</div>;
}
