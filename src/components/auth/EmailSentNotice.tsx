import { useEffect, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { authRedirectUrl } from "@/config/site";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, MailCheck, ArrowLeft } from "lucide-react";

interface EmailSentNoticeProps {
  email: string;
  onBack: () => void;
}

/**
 * Shown right after signup. The confirmation email contains a "Verify Email"
 * button that lands on /auth/confirmed, so there is nothing to type here —
 * the user just needs to open their inbox (or resend the email).
 */
const EmailSentNotice = ({ email, onBack }: EmailSentNoticeProps) => {
  const [resendLoading, setResendLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown(cooldown - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const handleResend = async () => {
    setResendLoading(true);
    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email,
        options: {
          emailRedirectTo: authRedirectUrl(
            "/auth/confirmed",
            Capacitor.isNativePlatform() ? "app" : "web",
          ),
        },
      });
      if (error) throw error;
      toast.success("We sent the verification email again");
      setCooldown(60);
    } catch {
      toast.error("Failed to resend the email. Please try again.");
    } finally {
      setResendLoading(false);
    }
  };

  return (
    <Card className="w-full bg-card/95 backdrop-blur-xl border-border/50">
      <CardHeader className="space-y-3 text-center">
        <div className="mx-auto w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
          <MailCheck className="w-7 h-7 text-primary" />
        </div>
        <CardTitle className="text-xl font-bold text-foreground">Check your inbox</CardTitle>
        <CardDescription className="text-xs text-muted-foreground">
          We sent a verification link to{" "}
          <span className="font-medium text-foreground">{email}</span>. Tap
          “Verify Email” in that message to activate your account.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <p className="text-xs text-center text-muted-foreground">
          Can't find it? Check your spam folder — it can take a minute to arrive.
        </p>

        <Button
          onClick={handleResend}
          className="w-full h-9 rounded-lg text-sm font-semibold"
          disabled={resendLoading || cooldown > 0}
        >
          {resendLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend email"}
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={onBack}
          className="w-full text-xs text-muted-foreground"
        >
          <ArrowLeft className="mr-1 h-3 w-3" />
          Wrong email? Change it
        </Button>
      </CardContent>
    </Card>
  );
};

export default EmailSentNotice;
