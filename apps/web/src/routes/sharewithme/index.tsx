import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/sharewithme/")({
  component: RouteComponent,
});

function RouteComponent() {
  return <div>Hello "/sharewithme/"!</div>;
}
