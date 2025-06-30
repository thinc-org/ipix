import { Button } from "~/components/ui/button";

export function GoogleSignInButton() {
  const buttonOnClick = () => {
    console.log("click");
  };
  return (
    <Button
      onClick={buttonOnClick}
      variant="outline"
      className="py-7 text-2xl font-normal text-black/50 gap-3"
    >
      <img src="/base_resource/google_logo.svg"></img>
      Sign in With Google
    </Button>
  );
}
