import { SpacePage } from '@/features/space/space-page';
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/space/$spaceId/f/$folderId')({
  component: RouteComponent,
})

function RouteComponent() {
  const { spaceId, folderId } = Route.useParams()
  return   (
      <div>
        <SpacePage spaceInfo={{spaceId: spaceId, folderId: folderId}}/>
      </div>
    );
}
