import { Loader2Icon } from "lucide-react";
import { useState } from "react";
import { Button } from "~/components/ui/button";

export function GoogleSignInButton() {
  const [isLoading, setIsLoading] = useState(false);
  const buttonOnClick = () => {
    setIsLoading(true);

    //awaiting for oauth token
    setTimeout(() => {
      setIsLoading(false);
    }, 1000);
  };
  return (
    <>
      {isLoading ? (
        <Button
          variant={"secondary"}
          className="text-2xl font-normal text-black/50 py-7 border-1"
          disabled
        >
          <Loader2Icon
            className="animate-spin"
            style={{ width: "2rem", height: "2rem" }}
          />
          Loading
        </Button>
      ) : (
        <Button
          onClick={buttonOnClick}
          variant="outline"
          className="py-7 text-2xl font-normal text-black/50 gap-3 hover:text-black/50"
        >
          <img src="/base_resource/google_logo.svg" />
          Sign in With Google
        </Button>
      )}
    </>
  );
}
