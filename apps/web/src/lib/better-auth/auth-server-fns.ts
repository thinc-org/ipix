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

export const signInServerFn = createServerFn({ method: "POST" })
  .validator((provider: string) => provider)
  .handler(async ({ data: provider }) => {
    const result = await authClient.signIn.social({
      provider: provider as any,
    });
    return result;
  });

export type { Session };
