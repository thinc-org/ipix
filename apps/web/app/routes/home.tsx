import type { Route } from "./+types/home";
import { Welcome } from "../features/welcome";
import { TestUi } from "~/features/welcome/testUi";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "New React Router App" },
    { name: "description", content: "Welcome to React Router!" },
  ];
}

export default function Home() {
  return (
    <>
      <TestUi />
      <Welcome />
    </>
  );
}
