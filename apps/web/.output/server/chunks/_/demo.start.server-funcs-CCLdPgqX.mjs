import * as fs from 'node:fs';
import { a as createServerRpc, c as createServerFn } from './ssr.mjs';
import '@tanstack/react-router';
import '@tanstack/react-router-with-query';
import 'react/jsx-runtime';
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

export { updateCount_createServerFn_handler };
//# sourceMappingURL=demo.start.server-funcs-CCLdPgqX.mjs.map
