import { createFileRoute } from "@tanstack/react-router";
import { TestDialog } from "@/features/welcome/test-dialog";
import { TestUi } from "@/features/welcome/test-ui";

export const Route = createFileRoute("/")({
  component: App,
});

function App() {
  return (
    <>
      {/* <TestDialog /> */}
      <TestUi />
    </>
  );
}
