import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/space/')({
  loader: () => {
    throw redirect({to: '/'})
  },
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/space/"!</div>
}
