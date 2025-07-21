import { createServerFn } from "@tanstack/react-start";
import { getWebRequest } from "@tanstack/react-start/server";
import { authClient } from "./auth-client";

type Session = typeof authClient.$Infer.Session;

export const getSessionServerFn = createServerFn({
  method: "GET",
}).handler(async () => {
  const { headers } = getWebRequest()!;

  const session = await authClient.getSession({
    fetchOptions: {
      headers,
    },
  });
  return session.data || null;
});

export type { Session };
