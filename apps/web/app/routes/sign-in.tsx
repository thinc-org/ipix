import { GoogleSignInButton } from "~/features/sign-in/google-sign-in-button";
import { SignInBrand } from "~/features/sign-in/sign-in-brand";

export default function SignIn() {
  return (
    <>
      <div className="flex flex-col justify-center items-center min-h-screen gap-8">
        <SignInBrand />
        <GoogleSignInButton />
      </div>
    </>
  );
}
