import { useAssociatedSpace } from "@/features/space/hook";
import { SpacePage } from "@/features/space/space-page";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/myipix/")({
  component: RouteComponent,
});

function RouteComponent() {
  const getMyIpix = useAssociatedSpace({ searchString: "myipix", match: "exact" });

  const space = getMyIpix.data?.data?.data?.mySpace;
  console.log(space);
  
  if (getMyIpix.isLoading) return <div>Loading…</div>;
  if (getMyIpix.isError) return <div>Failed to load space.</div>;
  if (!space || !space[0]) return <div>No space found.</div>;
  const myIpix = space[0]
  
  return (
    <div>
      <SpacePage spaceInfo={{ spaceId: myIpix.id }} />
    </div>
  );
}
