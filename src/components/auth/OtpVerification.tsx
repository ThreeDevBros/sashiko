import { useState, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { toast } from "sonner";
import { Loader2, Mail, ArrowLeft } from "lucide-react";

interface OtpVerificationProps {
  email: string;
  onVerified: () => void;
  onBack: () => void;
}

const OtpVerification = ({ email, onVerified, onBack }: OtpVerificationProps) => {
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  const handleVerify = async () => {
    if (otp.length !== 6) {
      toast.error("Please enter the 6-digit code");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.verifyOtp({
        email,
        token: otp,
        type: "email",
      });

      if (error) throw error;
      toast.success("Email verified successfully!");
      onVerified();
    } catch (error: any) {
      toast.error(error.message || "Invalid or expired code. Please try again.");
      setOtp("");
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setResendLoading(true);
    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email,
      });
      if (error) throw error;
      toast.success("A new verification code has been sent to your email");
      setResendCooldown(60);
    } catch (error: any) {
      toast.error("Failed to resend code. Please try again.");
    } finally {
      setResendLoading(false);
    }
  };

  // Auto-submit when 6 digits entered
  useEffect(() => {
    if (otp.length === 6) {
      handleVerify();
    }
  }, [otp]);

  return (
    <Card className="w-full bg-card/95 backdrop-blur-xl border-border/50">
      <CardHeader className="space-y-3 text-center">
        <div className="mx-auto w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
          <Mail className="w-7 h-7 text-primary" />
        </div>
        <CardTitle className="text-xl font-bold text-foreground">
          Verify your email
        </CardTitle>
        <CardDescription className="text-xs text-muted-foreground">
          We sent a 6-digit code to{" "}
          <span className="font-medium text-foreground">{email}</span>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex justify-center">
          <InputOTP
            maxLength={6}
            value={otp}
            onChange={setOtp}
            disabled={loading}
          >
            <InputOTPGroup>
              <InputOTPSlot index={0} />
              <InputOTPSlot index={1} />
              <InputOTPSlot index={2} />
              <InputOTPSlot index={3} />
              <InputOTPSlot index={4} />
              <InputOTPSlot index={5} />
            </InputOTPGroup>
          </InputOTP>
        </div>

        <Button
          onClick={handleVerify}
          className="w-full h-9 rounded-lg text-sm font-semibold"
          disabled={otp.length !== 6 || loading}
        >
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Verify Email
        </Button>

        <div className="text-center space-y-2">
          <p className="text-xs text-muted-foreground">
            Didn't receive the code?
          </p>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleResend}
            disabled={resendLoading || resendCooldown > 0}
            className="text-xs text-primary"
          >
            {resendLoading && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
            {resendCooldown > 0
              ? `Resend in ${resendCooldown}s`
              : "Resend code"}
          </Button>
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={onBack}
          className="w-full text-xs text-muted-foreground"
        >
          <ArrowLeft className="mr-1 h-3 w-3" />
          Back to sign up
        </Button>
      </CardContent>
    </Card>
  );
};

export default OtpVerification;
