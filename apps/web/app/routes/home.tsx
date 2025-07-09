import type { Route } from "./+types/home";
import { Welcome } from "~/features/welcome/welcome";
import { TestUi } from "../features/welcome";
import { TestDialog } from "~/features/welcome/test-dialog";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "New React Router App" },
    { name: "description", content: "Welcome to React Router!" },
  ];
}

export default function Home() {
  return (
    <>
      <TestDialog />
      <TestUi />
    </>
  );
}
