import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getSessionServerFn } from "./auth-server-fns";
import type { Session } from "./auth-server-fns";
import { authClient } from "./auth-client";

export function useAuth() {
  const queryClient = useQueryClient();

  const { data: session, refetch } = useQuery({
    queryKey: ["auth-session"],
    queryFn: () => getSessionServerFn(),
  });

  const signInMutation = useMutation({
    mutationFn: async (provider: string) =>
      authClient.signIn.social({ provider: provider }),
    onSuccess: (result) => {
      // Handle OAuth redirect
      if (result && result.data && result.data.url) {
        window.location.href = result.data.url;
      } else {
        // For non-OAuth sign-ins, just invalidate the session
        queryClient.invalidateQueries({ queryKey: ["auth-session"] });
      }
    },
    onError: (error) => {
      console.error("Sign-in error:", error);
    },
  });

  const signOutMutation = useMutation({
    mutationFn: async () => {
      return authClient.signOut();
    },
    onSuccess: () => {
      refetch();
      void queryClient.invalidateQueries();
    },
    onError: (error) => {
      console.error("Sign-out error:", error);
    },
  });

  return {
    session,
    refetch,
    signIn: signInMutation.mutate,
    signOut: signOutMutation.mutate,
    isSigningIn: signInMutation.isPending,
    isSigningOut: signOutMutation.isPending,
  };
}

export type { Session };
