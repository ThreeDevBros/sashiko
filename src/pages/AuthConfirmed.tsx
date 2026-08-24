import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Check, Loader2, Smartphone, X } from "lucide-react";

/**
 * Landing page for the "Verify Email" button inside auth emails.
 * Supabase redirects here after confirming the token; the session (if any)
 * arrives in the URL fragment and is picked up by the Supabase client.
 * `?src=app` means the signup started inside the native app, so we offer a
 * deep link back into it instead of continuing in the browser.
 */
const APP_DEEP_LINK = "sashiko://auth-verified";

const AuthConfirmed = () => {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const fromApp = params.get("src") === "app";
  const [state, setState] = useState<"loading" | "success" | "error">("loading");

  useEffect(() => {
    let cancelled = false;

    const hash = window.location.hash;
    const hashError = hash.includes("error");

    const run = async () => {
      if (hashError) {
        if (!cancelled) setState("error");
        return;
      }
      // Give the client a moment to consume tokens from the URL fragment.
      await new Promise((r) => setTimeout(r, 400));
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      // Even without a session (e.g. verified on another device) the email is
      // confirmed at this point, so treat a clean redirect as success.
      setState(data.session || !hashError ? "success" : "error");
    };

    run();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="fixed inset-0 flex items-center justify-center px-6 pt-safe">
      <Card className="w-full max-w-sm bg-card/95 backdrop-blur-xl border-border/50">
        <CardContent className="pt-8 pb-7 space-y-6 text-center">
          <div
            className={`mx-auto w-16 h-16 rounded-full flex items-center justify-center ${
              state === "error" ? "bg-destructive/10" : "bg-primary/10"
            }`}
          >
            {state === "loading" && <Loader2 className="w-7 h-7 text-primary animate-spin" />}
            {state === "success" && <Check className="w-8 h-8 text-primary" />}
            {state === "error" && <X className="w-8 h-8 text-destructive" />}
          </div>

          <div className="space-y-2">
            <h1 className="text-xl font-bold text-foreground">
              {state === "loading" && "Verifying your email…"}
              {state === "success" && "Email verified"}
              {state === "error" && "Link expired"}
            </h1>
            <p className="text-xs text-muted-foreground">
              {state === "loading" && "Just a moment."}
              {state === "success" &&
                (fromApp
                  ? "You're all set. Head back to the Sashiko app to continue."
                  : "You're all set. You can start ordering now.")}
              {state === "error" &&
                "This verification link is no longer valid. Request a new code from the sign-up screen."}
            </p>
          </div>

          {state === "success" && (
            <div className="space-y-2">
              {fromApp && (
                <Button asChild className="w-full h-10 rounded-lg text-sm font-semibold">
                  <a href={APP_DEEP_LINK}>
                    <Smartphone className="mr-2 h-4 w-4" />
                    Open the Sashiko app
                  </a>
                </Button>
              )}
              <Button
                variant={fromApp ? "ghost" : "default"}
                className="w-full h-10 rounded-lg text-sm font-semibold"
                onClick={() => navigate("/")}
              >
                Continue in browser
              </Button>
            </div>
          )}

          {state === "error" && (
            <Button
              className="w-full h-10 rounded-lg text-sm font-semibold"
              onClick={() => navigate("/auth")}
            >
              Back to sign up
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AuthConfirmed;
