import { useAssociatedSpace } from '@/features/space/hook';
import { SpacePage } from '@/features/space/space-page';
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/space/$spaceId/')({
  component: RouteComponent,
})

function RouteComponent() {
  const { spaceId } = Route.useParams()
  const getMyspace = useAssociatedSpace({searchString:spaceId, match:'id'})
  const space = getMyspace.data?.data?.mySpace

  if (getMyspace.isLoading) return <div>Loading…</div>;
  if (getMyspace.isError) return <div>Failed to load space.</div>;
  if (!space || !space[0]) return <div>No space found.</div>;
  const mySpace = space[0]
  return   (
      <div>
        <SpacePage spaceInfo={{spaceId: spaceId, folderId: mySpace.rootFolderId}}/>
      </div>
    );
}
