import { SpacePage } from '@/features/space/space-page';
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/space/$spaceId/')({
  component: RouteComponent,
})

function RouteComponent() {
  const { spaceId } = Route.useParams()
  return   (
      <div>
        <SpacePage spaceInfo={{spaceId: spaceId}}/>
      </div>
    );
}
