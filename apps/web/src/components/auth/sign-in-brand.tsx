"use client";

import { cn } from "@/lib/utils";

import * as React from "react";
import * as LabelPrimitive from "@radix-ui/react-label";

export function SignInBrand({
  className,
}: React.ComponentProps<typeof LabelPrimitive.Root>) {
  return (
    <>
      <div className={cn("flex justify-center items-center gap-4", className)}>
        <img
          src="/base_resource/ipix_logo_red.svg"
          className={cn("h-24", className)}
        />
        <h1 className={cn("text-5xl", className)}>Sign in to iPix</h1>
      </div>
    </>
  );
}
