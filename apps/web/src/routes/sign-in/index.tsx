import { GoogleSignInButton } from "@/components/auth/google-sign-in-button";
import { SignInBrand } from "@/components/auth/sign-in-brand";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute('/sign-in/')({
  component: SignIn,
});

function SignIn() {
  return (
    <div className="flex flex-col justify-center items-center min-h-screen gap-8">
      <SignInBrand />
      <GoogleSignInButton />
    </div>
  );
}
