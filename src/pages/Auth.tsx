import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Loader2, ArrowLeft } from "lucide-react";
// Inline SVG icons to avoid importing 900KB react-icons bundles
const FcGoogle = ({ className = "" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" width="1em" height="1em">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z" fill="#4285F4"/>
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
  </svg>
);
const FaApple = ({ className = "" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 384 512" width="1em" height="1em" fill="currentColor">
    <path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z"/>
  </svg>
);
import { z } from "zod";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useTheme } from "@/components/ThemeProvider";
import sashikoLogo from "@/assets/sashiko-logo-transparent.png";
import EmailSentNotice from "@/components/auth/EmailSentNotice";
import { authRedirectUrl, siteUrl } from "@/config/site";
import { PasswordField } from "@/components/auth/PasswordField";
import { PasswordChecklist } from "@/components/auth/PasswordChecklist";
import { AuthField } from "@/components/auth/AuthField";

import { useHaptics } from "@/hooks/useHaptics";
import { useIsMobile } from "@/hooks/use-mobile";

import { useBranding } from "@/hooks/useBranding";
import { nativeAppleSignIn } from "@/lib/nativeAppleSignIn";
import { nativeGoogleSignIn } from "@/lib/nativeGoogleSignIn";
import { Capacitor } from "@capacitor/core";

// Show Apple Sign In on:
//  - iOS native app (Capacitor) — uses native plugin
//  - Safari on any Apple device (macOS, iPhone, iPad) — web flow works smoothly there
// Hidden on Android app, Chrome/Firefox/Edge on any platform, and non-Apple devices.
const shouldShowAppleButton = (): boolean => {
  if (Capacitor.isNativePlatform()) {
    return Capacitor.getPlatform() === 'ios';
  }
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  const isAppleDevice = /Macintosh|iPhone|iPad|iPod/.test(ua) ||
    // iPadOS 13+ reports as Mac; detect via touch points
    (navigator.platform === 'MacIntel' && (navigator as any).maxTouchPoints > 1);
  const isSafari = /^((?!chrome|android|crios|fxios|edgios).)*safari/i.test(ua);
  return isAppleDevice && isSafari;
};

/**
 * Map a raw auth error into a user-friendly message.
 * Returns null if the error should be silently swallowed (e.g. user cancellation).
 */
const getAuthErrorMessage = (error: any): string | null => {
  const msg = String(error?.message ?? error ?? '').toLowerCase();
  const code = String(error?.code ?? '').toLowerCase();

  // User cancelled — silent
  if (
    code === '12501' || code === '-5' ||
    msg.includes('cancel') || msg.includes('user closed') ||
    msg.includes('aborted by user')
  ) {
    return null;
  }

  // Google Play Services network error (status code 7) — very common on
  // emulators or when Play Services can't reach Google's servers.
  if (code === '7') {
    return "Google sign-in couldn't reach Google Play Services. Check your internet, update Google Play Services, or try on a physical device.";
  }

  // Network / connectivity
  if (
    msg.includes('network') || msg.includes('connectivity') ||
    msg.includes('failed to fetch') || msg.includes('ioexception') ||
    msg.includes('offline') || msg.includes('timeout') ||
    msg.includes('timed out')
  ) {
    return 'No internet connection. Please check your network and try again.';
  }

  // Rate limit
  if (msg.includes('rate limit') || msg.includes('too many') || msg.includes('429')) {
    return 'Too many attempts. Please wait a moment and try again.';
  }

  // Email not confirmed
  if (msg.includes('email not confirmed') || msg.includes('not confirmed')) {
    return 'Please verify your email before signing in.';
  }

  // Invalid credentials
  if (msg.includes('invalid login') || msg.includes('invalid credentials') || msg.includes('invalid email or password')) {
    return 'Incorrect email or password.';
  }

  // Already registered
  if (msg.includes('already registered') || msg.includes('already exists') || msg.includes('user already')) {
    return 'This email is already registered. Try signing in instead.';
  }

  // Google Play Services unavailable
  if (msg.includes('play services') || msg.includes('google_play')) {
    return 'Google sign-in unavailable. Please update Google Play Services.';
  }

  // Apple not available
  if (msg.includes('apple') && (msg.includes('not available') || msg.includes('unavailable'))) {
    return 'Apple sign-in is not available on this device.';
  }

  // Fallback: trim and capitalize
  const raw = error?.message ? String(error.message) : '';
  if (raw) return raw.charAt(0).toUpperCase() + raw.slice(1);
  return 'Something went wrong. Please try again.';
};

const passwordSchema = z.string()
  .min(12, "Password must be at least 12 characters")
  .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
  .regex(/[a-z]/, "Password must contain at least one lowercase letter")
  .regex(/[0-9]/, "Password must contain at least one number");

const Auth = () => {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { branding } = useBranding();
  const navigate = useNavigate();
  const haptics = useHaptics();
  const isMobile = useIsMobile();
  const isLightTheme = theme === 'light';
  const appleButtonClass = isLightTheme
    ? "h-9 rounded-lg bg-black hover:bg-black/90 text-white border-none text-sm font-semibold shadow-md"
    : "h-9 rounded-lg bg-white hover:bg-white/90 text-black border-none text-sm font-semibold shadow-md";
  const appleIconClass = isLightTheme ? "mr-2 !h-7 !w-7 text-white" : "mr-2 !h-7 !w-7 text-black";
  const showAppleButton = shouldShowAppleButton();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [signupConfirmPassword, setSignupConfirmPassword] = useState("");
  const [resetEmail, setResetEmail] = useState("");
  const [resetLoading, setResetLoading] = useState(false);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [isPasswordReset, setIsPasswordReset] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showOtpVerification, setShowOtpVerification] = useState(false);
  const [signupEmail, setSignupEmail] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'signin' | 'signup'>('signin');
  const [socialPending, setSocialPending] = useState<'google' | 'apple' | null>(null);
  const [signupCooldown, setSignupCooldown] = useState(0);

  // Tick the create-account cooldown down once per second.
  useEffect(() => {
    if (signupCooldown <= 0) return;
    const id = window.setInterval(() => {
      setSignupCooldown((s) => (s <= 1 ? 0 : s - 1));
    }, 1000);
    return () => window.clearInterval(id);
  }, [signupCooldown]);

  // Signup validation
  const isFullNameValid = fullName.trim().length >= 2;
  const phoneDigits = phone.replace(/\D/g, "");
  const isPhoneValid = phoneDigits.length >= 6;
  const isPasswordValid = passwordSchema.safeParse(password).success;
  const showConfirmField = password.trim().length > 0;
  const passwordsMatch = signupConfirmPassword === password;
  const canCreateAccount = isFullNameValid && email.trim().length > 0 && isPhoneValid && isPasswordValid && passwordsMatch && !loading && signupCooldown === 0;

  // Lock html/body to viewport so the gradient background covers the entire screen
  // (prevents the dark strip from appearing below the fixed background layer)
  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const prev = {
      htmlOverflow: html.style.overflow,
      htmlHeight: html.style.height,
      htmlBg: html.style.backgroundColor,
      bodyOverflow: body.style.overflow,
      bodyHeight: body.style.height,
      bodyBg: body.style.backgroundColor,
    };
    const bgColor = branding?.login_bg_color || 'hsl(var(--background))';
    html.style.overflow = 'hidden';
    html.style.height = '100%';
    html.style.backgroundColor = bgColor;
    body.style.overflow = 'hidden';
    body.style.height = '100%';
    body.style.backgroundColor = bgColor;
    return () => {
      html.style.overflow = prev.htmlOverflow;
      html.style.height = prev.htmlHeight;
      html.style.backgroundColor = prev.htmlBg;
      body.style.overflow = prev.bodyOverflow;
      body.style.height = prev.bodyHeight;
      body.style.backgroundColor = prev.bodyBg;
    };
  }, [branding?.login_bg_color]);

  useEffect(() => {
    // Check if this is a password reset flow
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    const type = hashParams.get('type');
    
    if (type === 'recovery') {
      setIsPasswordReset(true);
      return;
    }

    const redirectByRole = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) return;
        const currentUser = session.user;
      
      // Fetch roles to determine redirect
      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', currentUser.id);
      
      const roles = roleData?.map(r => r.role) || [];
      const { getRoleBasedRoute } = await import('@/hooks/useRoleRedirect');
      navigate(getRoleBasedRoute(roles));
      } catch (err) {
        console.error('[Auth] redirectByRole error:', err);
      }
    };

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        redirectByRole();
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session && !isPasswordReset) {
        redirectByRole();
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate, isPasswordReset]);

  const showAuthError = (error: any, fallback?: string) => {
    const msg = getAuthErrorMessage(error);
    if (msg === null) return; // silent (user cancelled)
    const finalMsg = msg || fallback || 'Something went wrong. Please try again.';
    setAuthError(finalMsg);
    haptics.error();
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);

    if (!isFullNameValid) {
      const m = "Full name must be at least 2 characters";
      setAuthError(m); haptics.error(); return;
    }
    if (!isPhoneValid) {
      const m = "Phone number must contain at least 6 digits";
      setAuthError(m); haptics.error(); return;
    }
    const passwordValidation = passwordSchema.safeParse(password);
    if (!passwordValidation.success) {
      const m = passwordValidation.error.errors[0].message;
      setAuthError(m); haptics.error(); return;
    }
    if (!passwordsMatch) {
      const m = "Passwords do not match";
      setAuthError(m); haptics.error(); return;
    }
    
    setLoading(true);

    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
            phone: phone.trim(),
          },
          // The email's "Verify Email" button always lands on our own domain
          // (never a build/preview host). `src=app` makes /auth/confirmed
          // offer a deep link back into the native app.
          emailRedirectTo: authRedirectUrl(
            "/auth/confirmed",
            Capacitor.isNativePlatform() ? "app" : "web",
          ),
        },
      });

      if (error) throw error;
      setSignupEmail(email);
      setShowOtpVerification(true);
      haptics.success();
      toast.success("Verification email sent — check your inbox!");
    } catch (error: any) {
      console.error('[Auth] Sign up failed:', error);
      // Detect Supabase rate-limit responses and convert them into a visible
      // countdown on the button instead of a generic error toast.
      const raw = String(error?.message || '').toLowerCase();
      const secondsMatch = raw.match(/after\s+(\d+)\s*seconds?/);
      const isRate =
        error?.status === 429 ||
        raw.includes('rate limit') ||
        raw.includes('too many') ||
        secondsMatch !== null;
      if (isRate) {
        const secs = secondsMatch ? parseInt(secondsMatch[1], 10) : 30;
        setSignupCooldown(Math.max(5, Math.min(secs, 120)));
      }
      showAuthError(error, t('auth.createFailed'));
    } finally {
      setLoading(false);
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setLoading(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;
      haptics.success();
      toast.success(t('auth.welcomeBack'));
    } catch (error: any) {
      console.error('[Auth] Sign in failed:', error);
      const mapped = getAuthErrorMessage(error);
      // For credential errors, use generic message to prevent email enumeration.
      // For network/rate-limit/etc, show the specific mapped message.
      const isCredErr = mapped === 'Incorrect email or password.' || !mapped;
      const finalMsg = isCredErr ? t('auth.invalidCredentials') : mapped;
      setAuthError(finalMsg);
      haptics.error();
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    console.log('[Auth] Google sign-in tapped');
    setAuthError(null);
    setSocialPending('google');
    haptics.light();
    try {
      const { error } = await nativeGoogleSignIn();
      if (error) {
        const code = (error as any)?.code;
        console.error(
          `[Auth] Google sign-in returned error: code=${code ?? 'n/a'} message=${error.message}`
        );
        throw error;
      }
      console.log('[Auth] Google sign-in completed without immediate error');
    } catch (error: any) {
      console.error(
        `[Auth] Google sign-in failed: code=${error?.code ?? 'n/a'} message=${error?.message ?? String(error)}`
      );
      showAuthError(error, 'Google sign-in failed. Please try again.');
    } finally {
      setSocialPending(null);
    }
  };

  const handleAppleSignIn = async () => {
    setAuthError(null);
    setSocialPending('apple');
    haptics.light();
    try {
      console.log('[Auth] Apple sign-in starting');
      const { error } = await nativeAppleSignIn();
      if (error) {
        console.error('[Auth] Apple sign-in error:', {
          message: error.message,
          name: error.name,
          stack: error.stack,
          raw: error,
        });
        throw error;
      }
      console.log('[Auth] Apple sign-in completed without immediate error');
    } catch (error: any) {
      console.error('[Auth] Apple sign-in failed:', error);
      showAuthError(error, 'Apple sign-in failed. Please try again.');
    } finally {
      setSocialPending(null);
    }
  };

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetEmail) {
      toast.error("Please enter your email address");
      return;
    }
    
    setResetLoading(true);

    try {
      // Keep recovery links on our own domain (no build/preview hosts).
      const { data, error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
        redirectTo: siteUrl("/"),
      });

      if (error) {
        console.error("Password reset error:", error);
        throw error;
      }
      
      console.log("Password reset email sent successfully", data);
      toast.success("Password reset email sent! Please check your inbox and spam folder.");
      setResetEmail("");
      setResetDialogOpen(false);
    } catch (error: any) {
      console.error("Password reset failed:", error);
      toast.error(getAuthErrorMessage(error) || "Failed to send reset email. Please try again.");
    } finally {
      setResetLoading(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    // Validate password strength
    const passwordValidation = passwordSchema.safeParse(newPassword);
    if (!passwordValidation.success) {
      toast.error(passwordValidation.error.errors[0].message);
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) {
        console.error("Password update error:", error);
        throw error;
      }
      
      console.log("Password updated successfully", data);
      toast.success("Password updated successfully! Redirecting...");
      setIsPasswordReset(false);
      setNewPassword("");
      setConfirmPassword("");
      
      // Wait a moment then navigate
      setTimeout(() => {
        navigate("/");
      }, 1500);
    } catch (error: any) {
      console.error("Password update failed:", error);
      toast.error(error.message || "Failed to update password. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Show password reset form if user came from reset email
  if (isPasswordReset) {
    return (
      <>
        {branding?.login_bg_color && (
          <div
            aria-hidden="true"
            style={{
              position: 'fixed',
              top: '-50vh',
              left: '-50vw',
              width: '200vw',
              height: '200vh',
              backgroundColor: 'hsl(var(--background))',
              backgroundImage: `linear-gradient(135deg, hsl(var(--background)) 0%, ${branding.login_bg_color} 30%, ${branding.login_bg_color} 70%, hsl(var(--background)) 100%)`,
              backgroundSize: '100vw 100vh',
              backgroundPosition: '50vw 50vh',
              backgroundRepeat: 'no-repeat',
              zIndex: 0,
              pointerEvents: 'none',
            }}
          />
        )}
        <div
          className="fixed inset-0 w-screen overflow-hidden flex items-center justify-center p-4"
          style={{
            height: '100vh',
            minHeight: '100vh',
            overscrollBehavior: 'none',
            paddingTop: 'max(1rem, env(safe-area-inset-top))',
            paddingBottom: 'max(1rem, env(safe-area-inset-bottom))',
            zIndex: 1,
          }}
        >
        <div className="w-full max-w-md max-h-full overflow-hidden">
          <Card className="w-full">
            <CardHeader className="space-y-1">
              <CardTitle className="text-lg font-bold text-center">
                Reset Your Password
              </CardTitle>
              <CardDescription className="text-center text-xs">
                Enter your new password below
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleUpdatePassword} className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="new-password" className="text-xs">New Password</Label>
                  <PasswordField
                    id="new-password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    minLength={12}
                    autoComplete="new-password"
                    enterKeyHint="next"
                    placeholder="Min 12 characters, with uppercase, lowercase & number"
                    className="h-9"
                  />
                  <PasswordChecklist value={newPassword} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="confirm-password" className="text-xs">Confirm Password</Label>
                  <PasswordField
                    id="confirm-password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    minLength={12}
                    autoComplete="new-password"
                    enterKeyHint="go"
                    className="h-9"
                  />
                  {confirmPassword.length > 0 && confirmPassword !== newPassword && (
                    <p className="text-[10px] text-destructive">Passwords do not match</p>
                  )}
                </div>
                <Button type="submit" className="w-full" disabled={loading} aria-busy={loading}>
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Update Password
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
      </>
    );
  }

  // Show OTP verification screen after signup
  if (showOtpVerification) {
    return (
      <>
        {branding?.login_bg_color && (
          <div
            aria-hidden="true"
            style={{
              position: 'fixed',
              top: '-50vh',
              left: '-50vw',
              width: '200vw',
              height: '200vh',
              backgroundColor: 'hsl(var(--background))',
              backgroundImage: `linear-gradient(135deg, hsl(var(--background)) 0%, ${branding.login_bg_color} 30%, ${branding.login_bg_color} 70%, hsl(var(--background)) 100%)`,
              backgroundSize: '100vw 100vh',
              backgroundPosition: '50vw 50vh',
              backgroundRepeat: 'no-repeat',
              zIndex: 0,
              pointerEvents: 'none',
            }}
          />
        )}
        <div 
          className="fixed inset-0 w-screen overflow-hidden flex items-center justify-center p-4"
          style={{
            height: '100vh',
            minHeight: '100vh',
            overscrollBehavior: 'none',
            paddingTop: 'max(1rem, env(safe-area-inset-top))',
            paddingBottom: 'max(1rem, env(safe-area-inset-bottom))',
            zIndex: 1,
          }}
        >
        <div className="absolute inset-0 opacity-10">
          <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="food-bg-otp" x="0" y="0" width="120" height="120" patternUnits="userSpaceOnUse">
                <path d="M20 20 Q30 10 40 20 Q50 30 40 40 Q30 50 20 40 Z" stroke="hsl(var(--primary))" strokeWidth="2" fill="none" opacity="0.3"/>
                <circle cx="70" cy="30" r="8" stroke="hsl(var(--accent))" strokeWidth="2" fill="none" opacity="0.3"/>
                <path d="M80 70 L90 80 M80 80 L90 70" stroke="hsl(var(--primary))" strokeWidth="2" opacity="0.3"/>
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#food-bg-otp)" />
          </svg>
        </div>
        <div className="w-full max-w-md relative z-10">
          <div className="text-center mb-4">
            <div className="mx-auto mb-2 flex items-center justify-center" style={{ width: `${Math.min((branding as any)?.login_logo_size || 160, 300)}px`, height: `${Math.min((branding as any)?.login_logo_size || 160, 300)}px` }}>
              <img 
                src={branding?.login_logo_url || sashikoLogo} 
                alt={branding?.tenant_name || "Sashiko Asian Fusion"} 
                className="w-full h-full object-contain invert dark:invert"
              />
            </div>
          </div>
          <EmailSentNotice
            email={signupEmail}
            onBack={() => {
              setShowOtpVerification(false);
            }}
          />

        </div>
      </div>
      </>
    );
  }

  const socialRow = (
    <div className="flex flex-col gap-3">
      {showAppleButton && (
        <button
          type="button"
          onClick={handleAppleSignIn}
          disabled={socialPending !== null || loading}
          aria-busy={socialPending === 'apple'}
          className="inline-flex h-12 w-full items-center justify-center gap-2.5 rounded-full border border-foreground/15 bg-background/70 backdrop-blur-sm text-sm font-medium text-foreground transition-all hover:bg-background active:scale-[0.985] disabled:opacity-60"
        >
          {socialPending === 'apple' ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <FaApple className="h-[18px] w-[18px]" />
          )}
          {t('auth.continueWithApple')}
        </button>
      )}
      <button
        type="button"
        onClick={handleGoogleSignIn}
        disabled={socialPending !== null || loading}
        aria-busy={socialPending === 'google'}
        className="inline-flex h-12 w-full items-center justify-center gap-2.5 rounded-full border border-foreground/15 bg-background/70 backdrop-blur-sm text-sm font-medium text-foreground transition-all hover:bg-background active:scale-[0.985] disabled:opacity-60"
      >
        {socialPending === 'google' ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <FcGoogle className="!h-[18px] !w-[18px]" />
        )}
        {t('auth.continueWithGoogle')}
      </button>
    </div>
  );

  return (
    <>
      {branding?.login_bg_color && (
        <div
          aria-hidden="true"
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'hsl(var(--background))',
            backgroundImage: `radial-gradient(120% 80% at 50% -10%, ${branding.login_bg_color} 0%, transparent 70%)`,
            zIndex: 0,
            pointerEvents: 'none',
          }}
        />
      )}
      <div
        className="fixed inset-0 z-[1] w-screen overflow-y-auto"
        style={{ overscrollBehavior: 'none' }}
      >
        <div
          className="mx-auto flex min-h-full w-full max-w-md flex-col px-7"
          style={{
            paddingTop: 'max(2.5rem, calc(env(safe-area-inset-top) + 1.5rem))',
            paddingBottom: 'max(1.75rem, env(safe-area-inset-bottom))',
          }}
        >
          {/* Brand */}
          <div className="mb-10 flex flex-col items-center text-center">
            <div
              className="flex items-center justify-center"
              style={{
                width: `${Math.min((branding as any)?.login_logo_size || 150, 300)}px`,
                height: `${Math.min((branding as any)?.login_logo_size || 150, 300)}px`,
              }}
            >
              <img
                src={branding?.login_logo_url || sashikoLogo}
                alt={branding?.tenant_name || 'Sashiko Asian Fusion'}
                className="h-full w-full animate-enter object-contain invert dark:invert"
              />
            </div>
            <p
              className="mt-1 text-[10px] font-medium uppercase tracking-[0.22em] text-muted-foreground"
              style={{
                color: (branding as any)?.login_tagline_color || undefined,
                fontWeight: (branding as any)?.login_tagline_bold ? 'bold' : undefined,
                fontStyle: (branding as any)?.login_tagline_italic ? 'italic' : undefined,
                textDecoration: (branding as any)?.login_tagline_underline ? 'underline' : undefined,
              }}
            >
              {(branding as any)?.login_tagline || 'Authentic Asian Cuisine'}
            </p>
          </div>

          {/* Social first — fastest path in */}
          {socialRow}

          <div className="my-8 flex items-center gap-4">
            <span className="h-px flex-1 bg-foreground/15" />
            <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              {t('auth.or')}
            </span>
            <span className="h-px flex-1 bg-foreground/15" />
          </div>

          {/* Sign in / Sign up switch */}
          <div className="mb-8 flex border-b border-foreground/12">
            {(['signin', 'signup'] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => { setActiveTab(tab); setAuthError(null); haptics.light(); }}
                className={`relative flex-1 pb-3 font-editorial text-2xl leading-none transition-colors duration-200 ${
                  activeTab === tab ? 'text-foreground' : 'text-muted-foreground/60 hover:text-muted-foreground'
                }`}
              >
                {tab === 'signin' ? t('auth.signIn') : t('auth.signUp')}
                <span
                  aria-hidden
                  className={`absolute -bottom-px left-0 h-[2px] w-full bg-primary transition-transform duration-300 ease-out ${
                    activeTab === tab ? 'scale-x-100' : 'scale-x-0'
                  }`}
                />
              </button>
            ))}
          </div>

          {authError && (
            <div
              role="alert"
              aria-live="polite"
              className="mb-6 flex items-start gap-2 border-l-2 border-destructive pl-3"
            >
              <p className="flex-1 break-words text-xs font-medium text-destructive">{authError}</p>
              <button
                type="button"
                onClick={() => setAuthError(null)}
                className="text-xs leading-none text-destructive/70 hover:text-destructive"
                aria-label="Dismiss"
              >
                ✕
              </button>
            </div>
          )}

          {activeTab === 'signin' ? (
            <form
              key="signin"
              onSubmit={handleSignIn}
              className="flex flex-col gap-5 animate-in fade-in-0 slide-in-from-left-6 duration-300 ease-out"
            >
              <AuthField
                id="signin-email"
                label={t('auth.email')}
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus={!isMobile}
                autoComplete="email"
                inputMode="email"
                enterKeyHint="next"
                autoCapitalize="none"
                spellCheck={false}
              />
              <AuthField
                id="signin-password"
                label={t('auth.password')}
                reveal
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                enterKeyHint="go"
              />

              <div className="flex justify-end">
                <Dialog
                  open={resetDialogOpen}
                  onOpenChange={(o) => { setResetDialogOpen(o); if (o && email) setResetEmail(email); }}
                >
                  <DialogTrigger asChild>
                    <button type="button" className="text-xs text-muted-foreground transition-colors hover:text-primary">
                      {t('auth.forgotPassword')}
                    </button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>{t('auth.resetPassword')}</DialogTitle>
                      <DialogDescription>{t('auth.resetPasswordDesc')}</DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handlePasswordReset} className="space-y-3">
                      <div className="space-y-1.5">
                        <Label htmlFor="reset-email">{t('auth.email')}</Label>
                        <Input
                          id="reset-email"
                          type="email"
                          placeholder="your@email.com"
                          value={resetEmail}
                          onChange={(e) => setResetEmail(e.target.value)}
                          required
                          autoComplete="email"
                          inputMode="email"
                          enterKeyHint="go"
                          autoCapitalize="none"
                          spellCheck={false}
                        />
                      </div>
                      <Button type="submit" className="w-full" disabled={resetLoading}>
                        {resetLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {t('auth.sendResetLink')}
                      </Button>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>

              <button
                type="submit"
                disabled={loading || socialPending !== null}
                aria-busy={loading}
                className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-primary text-sm font-semibold tracking-wide text-primary-foreground shadow-[0_8px_24px_-12px_hsl(var(--primary))] transition-all hover:opacity-95 active:scale-[0.985] disabled:opacity-60"
              >
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                {t('auth.login')}
              </button>
            </form>
          ) : (
            <form
              key="signup"
              onSubmit={handleSignUp}
              className="flex flex-col gap-5 animate-in fade-in-0 slide-in-from-right-6 duration-300 ease-out"
            >
              <AuthField
                id="signup-name"
                label={t('auth.fullName')}
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                autoComplete="name"
                autoCapitalize="words"
                enterKeyHint="next"
              />
              <AuthField
                id="signup-email"
                label={t('auth.email')}
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                inputMode="email"
                enterKeyHint="next"
                autoCapitalize="none"
                spellCheck={false}
              />
              <AuthField
                id="signup-phone"
                label={t('auth.phone')}
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
                autoComplete="tel"
                inputMode="tel"
                enterKeyHint="next"
              />
              <div className="flex flex-col gap-2">
                <AuthField
                  id="signup-password"
                  label={t('auth.password')}
                  reveal
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={12}
                  autoComplete="new-password"
                  enterKeyHint="next"
                />
                <PasswordChecklist value={password} />
              </div>

              <div
                className="overflow-hidden transition-all duration-300 ease-in-out"
                style={{
                  maxHeight: showConfirmField ? '96px' : '0px',
                  opacity: showConfirmField ? 1 : 0,
                  transform: showConfirmField ? 'translateY(0)' : 'translateY(-8px)',
                }}
              >
                <AuthField
                  id="signup-confirm-password"
                  label={t('auth.confirmPassword')}
                  reveal
                  value={signupConfirmPassword}
                  onChange={(e) => setSignupConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                  enterKeyHint="go"
                />
                {signupConfirmPassword.length > 0 && !passwordsMatch && (
                  <p className="mt-1.5 text-[10px] text-destructive">Passwords do not match</p>
                )}
              </div>

              <button
                type="submit"
                disabled={!canCreateAccount || socialPending !== null}
                aria-busy={loading}
                className="relative inline-flex h-12 w-full items-center justify-center overflow-hidden rounded-full bg-primary text-sm font-semibold tracking-wide text-primary-foreground shadow-[0_8px_24px_-12px_hsl(var(--primary))] transition-all hover:opacity-95 active:scale-[0.985] disabled:opacity-50"
              >
                {signupCooldown > 0 && (
                  <span
                    aria-hidden
                    className="pointer-events-none absolute inset-y-0 left-0 bg-primary-foreground/15 transition-[width] duration-1000 ease-linear"
                    style={{ width: `${(signupCooldown / Math.max(signupCooldown, 30)) * 100}%` }}
                  />
                )}
                <span className="relative flex items-center justify-center gap-2">
                  {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                  {signupCooldown > 0 ? `Try again in ${signupCooldown}s` : t('auth.createAccount')}
                </span>
              </button>
            </form>
          )}

          {/* Guest */}
          <div className="pt-7 text-center">
            <button
              type="button"
              onClick={() => {
                localStorage.setItem('guestMode', 'true');
                navigate('/');
              }}
              className="border-b border-primary/30 pb-0.5 text-sm font-medium text-primary transition-colors hover:border-primary"
            >
              {t('auth.continueAsGuest')}
            </button>
          </div>

          {/* Legal */}
          <div className="mt-auto pt-12 text-center">
            <p className="text-[10px] uppercase leading-relaxed tracking-[0.12em] text-muted-foreground/70">
              By continuing, you agree to our{' '}
              <button type="button" onClick={() => navigate('/legal/terms')} className="underline">Terms of Service</button>
              {' '}&{' '}
              <button type="button" onClick={() => navigate('/legal/privacy')} className="underline">Privacy Policy</button>
            </p>
            <p className="mt-2 text-[10px] uppercase tracking-[0.12em] text-muted-foreground/50">
              {branding?.tenant_name || 'Sashiko'} © {new Date().getFullYear()}
            </p>
          </div>
        </div>
      </div>
    </>
  );
};


export default Auth;
