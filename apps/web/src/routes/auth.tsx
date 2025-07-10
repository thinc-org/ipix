import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useAuth } from "../lib/better-auth/auth-hooks";
import { authClient } from "../lib/better-auth/auth-client";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/auth")({
  component: AuthComponent,
});

function AuthComponent() {
  const { session, refetch, signIn, signOut, isSigningIn, isSigningOut } =
    useAuth();
  const navigate = useNavigate();
  const [isProcessingCallback, setIsProcessingCallback] = useState(false);

  // Handle OAuth callback
  useEffect(() => {
    const handleCallback = async () => {
      try {
        const urlParams = new URLSearchParams(window.location.search);
        const hasOAuthParams =
          urlParams.has("code") ||
          urlParams.has("state") ||
          urlParams.has("error");

        if (hasOAuthParams) {
          setIsProcessingCallback(true);
          console.log("Processing OAuth callback...");

          // Check for errors first
          const error = urlParams.get("error");
          if (error) {
            console.error("OAuth error:", error);
            setIsProcessingCallback(false);
            return;
          }

          // Wait a bit for the backend to process the callback and set cookies
          await new Promise((resolve) => setTimeout(resolve, 2000));

          // Try to get the session
          const sessionResult = await authClient.getSession();
          console.log("Session after callback:", sessionResult);

          // Refetch to update the UI
          await refetch();

          // Clean up URL and redirect to home or dashboard
          window.history.replaceState(
            {},
            document.title,
            window.location.pathname,
          );
          setIsProcessingCallback(false);

          // If we have a session, redirect to home
          if (sessionResult.data) {
            navigate({ to: "/" });
          }
        }
      } catch (error) {
        console.error("OAuth callback error:", error);
        setIsProcessingCallback(false);
      }
    };

    handleCallback();
  }, [refetch, navigate]);

  const handleSignIn = async () => {
    signIn("github");
  };

  const handleSignOut = async () => {
    signOut();
    refetch();
  };

  return (
    <div className="p-2">
      <h3 className="text-xl font-bold">Better-Auth GitHub Sign In</h3>
      <div className="p-4">
        {isProcessingCallback ? (
          <div className="text-center">
            <p>Processing OAuth callback...</p>
            <div className="mt-2">Please wait...</div>
          </div>
        ) : session ? (
          <div>
            <p>Welcome, {session.user?.email}</p>
            <button
              onClick={handleSignOut}
              disabled={isSigningOut}
              className="mt-2 px-4 py-2 bg-red-500 text-white rounded disabled:opacity-50"
            >
              {isSigningOut ? "Signing Out..." : "Sign Out"}
            </button>
          </div>
        ) : (
          <button
            onClick={handleSignIn}
            disabled={isSigningIn}
            className="px-4 py-2 bg-blue-500 text-white rounded disabled:opacity-50"
          >
            {isSigningIn ? "Signing In..." : "Sign In with GitHub"}
          </button>
        )}
      </div>
      <pre className="mt-4 bg-gray-100 p-4 rounded">
        {JSON.stringify(session, null, 2)}
      </pre>
    </div>
  );
}
