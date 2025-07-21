import * as React from "react";
import { Loader2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/better-auth/auth-hooks";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { authClient } from "@/lib/better-auth/auth-client";

// define cva-driven classes
const googleButtonVariants = cva("py-7 text-2xl font-normal gap-3", {
  variants: {
    loading: {
      true: "text-black/50 border",
      false: "text-black/50",
    },
  },
  defaultVariants: {
    loading: false,
  },
});

type GoogleSignInButtonProps = React.ComponentProps<typeof Button> &
  VariantProps<typeof googleButtonVariants>;

export function GoogleSignInButton({
  className,
  ...props
}: GoogleSignInButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const { session, refetch, signIn, signOut } = useAuth();
  const navigate = useNavigate();
  const [isProcessingCallback, setIsProcessingCallback] = useState(false);

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
            setIsLoading(false);
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
            window.location.pathname
          );
          setIsLoading(false);
          setIsProcessingCallback(false);

          // If we have a session, redirect to home
          if (sessionResult.data) {
            navigate({ to: "/" });
          }
        }
      } catch (error) {
        console.error("OAuth callback error:", error);
        setIsLoading(false);
        setIsProcessingCallback(false);
      }
    };

    handleCallback();
  }, [refetch, navigate]);

  const handleSignIn = () => {
    try {
      setIsLoading(true);
      signIn("google");
    } catch (error) {
      console.error("Sign-in error:", error);
      setIsLoading(false);
    }
  };

  const handleSignOut = () => {
    signOut();
  };

  return (
    <>
      <Button
        onClick={session ? handleSignOut : handleSignIn}
        disabled={isLoading}
        variant={isLoading ? "secondary" : session ? "destructive" : "outline"}
        className={cn(googleButtonVariants({ loading: isLoading }), className)}
        {...props}
      >
        {isLoading ? (
          <>
            <Loader2Icon
              className="animate-spin"
              style={{ width: "2rem", height: "2rem" }}
            />
            Loading
          </>
        ) : session ? (
          <div className="text-white">Sign out</div>
        ) : (
          <>
            <img src="/base_resource/google_logo.svg" alt="Google logo" />
            Sign in With Google
          </>
        )}
      </Button>
    </>
  );
}
