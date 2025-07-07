import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getSessionServerFn, signInServerFn, signOutServerFn } from "./auth-server-fns";
import type { Session } from "./auth-server-fns";

export function useAuth() {
  const queryClient = useQueryClient();

  const { data: session, refetch } = useQuery({
    queryKey: ["auth-session"],
    queryFn: () => getSessionServerFn(),
  });

  const signInMutation = useMutation({
    mutationFn: (provider: string) => signInServerFn({ data: provider }),
    onSuccess: (result) => {
      // Handle OAuth redirect
      if (result && result.data && result.data.url) {
        window.location.href = result.data.url;
      } else {
        // For non-OAuth sign-ins, just invalidate the session
        queryClient.invalidateQueries({ queryKey: ["auth-session"] });
      }
    },
  });

  const signOutMutation = useMutation({
    mutationFn: () => signOutServerFn(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["auth-session"] });
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
