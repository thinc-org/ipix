import { jsx, jsxs } from 'react/jsx-runtime';
import * as fs from 'node:fs';
import { createFileRoute, useRouter } from '@tanstack/react-router';
import { a as createServerRpc, c as createServerFn } from './ssr.mjs';
import '@tanstack/react-router-with-query';
import '@tanstack/react-query';
import '@tanstack/react-router-devtools';
import '@tanstack/react-query-devtools';
import 'tiny-invariant';
import 'tiny-warning';
import '@tanstack/router-core';
import '@tanstack/router-core/ssr/client';
import '@tanstack/history';
import '@tanstack/router-core/ssr/server';
import 'node:async_hooks';
import '@tanstack/react-router/ssr/server';

const filePath = "count.txt";
async function readCount() {
  return parseInt(await fs.promises.readFile(filePath, "utf-8").catch(() => "0"));
}
const getCount_createServerFn_handler = createServerRpc("src_routes_demo_start_server-funcs_tsx--getCount_createServerFn_handler", "/_serverFn", (opts, signal) => {
  return getCount.__executeServer(opts, signal);
});
const getCount = createServerFn({
  method: "GET"
}).handler(getCount_createServerFn_handler, () => {
  return readCount();
});
const updateCount_createServerFn_handler = createServerRpc("src_routes_demo_start_server-funcs_tsx--updateCount_createServerFn_handler", "/_serverFn", (opts, signal) => {
  return updateCount.__executeServer(opts, signal);
});
const updateCount = createServerFn({
  method: "POST"
}).validator((d) => d).handler(updateCount_createServerFn_handler, async ({
  data
}) => {
  const count = await readCount();
  await fs.promises.writeFile(filePath, `${count + data}`);
});
const Route = createFileRoute("/demo/start/server-funcs")({
  component: Home,
  loader: async () => await getCount()
});
function Home() {
  const router = useRouter();
  const state = Route.useLoaderData();
  return /* @__PURE__ */ jsx("div", { className: "p-4", children: /* @__PURE__ */ jsxs("button", { type: "button", onClick: () => {
    updateCount({
      data: 1
    }).then(() => {
      router.invalidate();
    });
  }, className: "bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded", children: [
    "Add 1 to ",
    state,
    "?"
  ] }) });
}

export { getCount_createServerFn_handler, updateCount_createServerFn_handler };
//# sourceMappingURL=demo.start.server-funcs-ubDf-6lU.mjs.map
