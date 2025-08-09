import { createFileRoute, redirect } from "@tanstack/react-router";
import { TestDialog } from "@/features/welcome/test-dialog";
import { TestUi } from "@/features/welcome/test-ui";
import { HomePage } from "@/features/welcome/home-page";
import { getSessionServerFn } from "@/lib/better-auth/auth-server-fns";

export const Route = createFileRoute("/")({
  loader: async () => {
    const session = await getSessionServerFn()
    if (!session?.user) {
      throw redirect({
        to: '/sign-in'
      })
    }

    throw redirect({
      to: '/myipix'
    })

  },
  component: App,
});

function App() {
  return (
    <>
      {/* <TestUi /> */}
      <HomePage />
    </>
  );
}
