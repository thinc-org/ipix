"use client";

import * as React from "react";
import { Loader2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

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
  const [isLoading, setIsLoading] = React.useState(false);

  const handleClick = () => {
    setIsLoading(true);
    // awaiting for oauth token
    setTimeout(() => setIsLoading(false), 1000);
  };

  return (
    <Button
      onClick={handleClick}
      disabled={isLoading}
      variant={isLoading ? "secondary" : "outline"}
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
      ) : (
        <>
          <img src="/base_resource/google_logo.svg" alt="Google logo" />
          Sign in With Google
        </>
      )}
    </Button>
  );
}
