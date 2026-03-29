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
import { FcGoogle } from "react-icons/fc";
import { FaApple } from "react-icons/fa";
import { z } from "zod";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useTheme } from "@/components/ThemeProvider";
import sashikoLogo from "@/assets/sashiko-logo-transparent.png";
import { lovable } from "@/integrations/lovable/index";
import { useBranding } from "@/hooks/useBranding";

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
  const isLightTheme = theme === 'light';
  const appleButtonClass = isLightTheme
    ? "h-9 rounded-lg bg-black hover:bg-black/90 text-white border-none text-sm font-semibold shadow-md"
    : "h-9 rounded-lg bg-white hover:bg-white/90 text-black border-none text-sm font-semibold shadow-md";
  const appleIconClass = isLightTheme ? "mr-2 !h-7 !w-7 text-white" : "mr-2 !h-7 !w-7 text-black";
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

  // Signup validation
  const isFullNameValid = fullName.trim().length >= 2;
  const phoneDigits = phone.replace(/\D/g, "");
  const isPhoneValid = phoneDigits.length >= 6;
  const isPasswordValid = passwordSchema.safeParse(password).success;
  const showConfirmField = password.trim().length > 0;
  const passwordsMatch = signupConfirmPassword === password;
  const canCreateAccount = isFullNameValid && email.trim().length > 0 && isPhoneValid && isPasswordValid && passwordsMatch && !loading;

  useEffect(() => {
    // Check if this is a password reset flow
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    const type = hashParams.get('type');
    
    if (type === 'recovery') {
      setIsPasswordReset(true);
      return;
    }

    const redirectByRole = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      
      // Fetch roles to determine redirect
      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id);
      
      const roles = roleData?.map(r => r.role) || [];
      const { getRoleBasedRoute } = await import('@/hooks/useRoleRedirect');
      navigate(getRoleBasedRoute(roles));
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

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!isFullNameValid) {
      toast.error("Full name must be at least 2 characters");
      return;
    }
    if (!isPhoneValid) {
      toast.error("Phone number must contain at least 6 digits");
      return;
    }
    const passwordValidation = passwordSchema.safeParse(password);
    if (!passwordValidation.success) {
      toast.error(passwordValidation.error.errors[0].message);
      return;
    }
    if (!passwordsMatch) {
      toast.error("Passwords do not match");
      return;
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
          emailRedirectTo: `${window.location.origin}/`,
        },
      });

      if (error) throw error;
      toast.success(t('auth.accountCreated'));
    } catch (error: any) {
      const message = error.message?.includes("already registered") 
        ? t('auth.alreadyRegistered')
        : t('auth.createFailed');
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;
      toast.success(t('auth.welcomeBack'));
    } catch (error: any) {
      // Use generic error message to prevent email enumeration
      toast.error(t('auth.invalidCredentials'));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/`,
        },
      });

      if (error) throw error;
    } catch (error: any) {
      toast.error("Failed to sign in with Google. Please try again.");
    }
  };

  const handleAppleSignIn = async () => {
    try {
      const { error } = await lovable.auth.signInWithOAuth("apple", {
        redirect_uri: window.location.origin,
      });

      if (error) throw error;
    } catch (error: any) {
      toast.error("Failed to sign in with Apple. Please try again.");
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
      const { data, error } = await supabase.auth.resetPasswordForEmail(resetEmail);

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
      toast.error(error.message || "Failed to send reset email. Please try again.");
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
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-secondary to-background p-4">
        <div className="w-full max-w-md">
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
                  <Input
                    id="new-password"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    minLength={12}
                    placeholder="Min 12 characters, with uppercase, lowercase & number"
                    className="h-9"
                  />
                  <p className="text-[10px] text-muted-foreground">
                    Must be at least 12 characters with uppercase, lowercase, and numbers
                  </p>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="confirm-password" className="text-xs">Confirm Password</Label>
                  <Input
                    id="confirm-password"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    minLength={12}
                    className="h-9"
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Update Password
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="min-h-screen max-h-screen flex items-center justify-center p-4 relative overflow-hidden"
      style={branding?.login_bg_color ? {
        background: `linear-gradient(135deg, hsl(var(--background)) 0%, ${branding.login_bg_color} 30%, ${branding.login_bg_color} 70%, hsl(var(--background)) 100%)`
      } : undefined}
    >
      {/* Food Pattern Background */}
      <div className="absolute inset-0 opacity-10">
        <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="food-bg" x="0" y="0" width="120" height="120" patternUnits="userSpaceOnUse">
              <path d="M20 20 Q30 10 40 20 Q50 30 40 40 Q30 50 20 40 Z" stroke="hsl(var(--primary))" strokeWidth="2" fill="none" opacity="0.3"/>
              <circle cx="70" cy="30" r="8" stroke="hsl(var(--accent))" strokeWidth="2" fill="none" opacity="0.3"/>
              <path d="M80 70 L90 80 M80 80 L90 70" stroke="hsl(var(--primary))" strokeWidth="2" opacity="0.3"/>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#food-bg)" />
        </svg>
      </div>

      <div className="w-full max-w-md relative z-10">
        
        {/* Logo Section */}
        <div className="text-center mb-4 mt-4">
          <div className="mx-auto mb-2 flex items-center justify-center" style={{ width: `${Math.min((branding as any)?.login_logo_size || 160, 300)}px`, height: `${Math.min((branding as any)?.login_logo_size || 160, 300)}px` }}>
            <img 
              src={branding?.login_logo_url || sashikoLogo} 
              alt={branding?.tenant_name || "Sashiko Asian Fusion"} 
              className="w-full h-full object-contain animate-enter invert dark:invert"
            />
          </div>
          <p
            className="text-xs"
            style={{
              color: (branding as any)?.login_tagline_color || undefined,
              fontWeight: (branding as any)?.login_tagline_bold ? 'bold' : 'normal',
              fontStyle: (branding as any)?.login_tagline_italic ? 'italic' : 'normal',
              textDecoration: (branding as any)?.login_tagline_underline ? 'underline' : 'none',
            }}
          >
            {(branding as any)?.login_tagline || 'Authentic Asian Cuisine'}
          </p>
        </div>

        <Card className="w-full bg-card/95 backdrop-blur-xl border-border/50">
          <CardHeader className="space-y-1">
            <CardTitle className="text-xl font-bold text-center text-foreground">
              {t('auth.signUpFree')}
            </CardTitle>
          </CardHeader>

        <CardContent>
          <Tabs defaultValue="signin" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signin">{t('auth.signIn')}</TabsTrigger>
              <TabsTrigger value="signup">{t('auth.signUp')}</TabsTrigger>
            </TabsList>

            <TabsContent value="signin">
              <form onSubmit={handleSignIn} className="space-y-3">
                <div className="space-y-1.5">
                  <Input
                    id="signin-email"
                    type="email"
                    placeholder={t('auth.email')}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="h-9 rounded-lg bg-muted/50 border-border/30 placeholder:text-muted-foreground/60"
                  />
                </div>
                <div className="space-y-1.5">
                  <Input
                    id="signin-password"
                    type="password"
                    placeholder={t('auth.password')}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="h-9 rounded-lg bg-muted/50 border-border/30"
                  />
                </div>

                <Button type="submit" className="w-full h-9 rounded-lg text-sm font-semibold" disabled={loading}>
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {t('auth.login')}
                </Button>

                <div className="relative my-4">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t border-border/30" />
                  </div>
                  <div className="relative flex justify-center text-xs">
                    <span className="bg-card px-3 text-foreground font-medium">
                      {t('auth.or')}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3">
                  <button
                    type="button"
                    onClick={handleAppleSignIn}
                    className={`${appleButtonClass} inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-lg transition-all active:scale-95`}
                  >
                    <FaApple className={appleIconClass} />
                    {t('auth.continueWithApple')}
                  </button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleGoogleSignIn}
                    className="h-9 rounded-lg bg-[#4285F4] hover:bg-[#3b78e7] dark:bg-[#4285F4] dark:hover:bg-[#3b78e7] border-none text-white dark:text-white text-sm font-semibold shadow-md"
                  >
                    <div className="mr-2 bg-white rounded-full w-6 h-6 flex items-center justify-center">
                      <FcGoogle className="!h-5 !w-5" />
                    </div>
                    {t('auth.continueWithGoogle')}
                  </Button>
                </div>
                
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => {
                    localStorage.setItem('guestMode', 'true');
                    navigate('/');
                  }}
                  className="w-full h-9 rounded-lg text-sm font-semibold"
                >
                  {t('auth.continueAsGuest')}
                </Button>

                <Dialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="link" className="w-full text-xs text-primary">
                      {t('auth.forgotPassword')}
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>{t('auth.resetPassword')}</DialogTitle>
                      <DialogDescription>
                        {t('auth.resetPasswordDesc')}
                      </DialogDescription>
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
                        />
                      </div>
                      <Button type="submit" className="w-full" disabled={resetLoading}>
                        {resetLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {t('auth.sendResetLink')}
                      </Button>
                    </form>
                  </DialogContent>
                </Dialog>
              </form>
            </TabsContent>

            <TabsContent value="signup">
              <form onSubmit={handleSignUp} className="space-y-3">
                <div className="space-y-1.5">
                  <Input
                    id="signup-name"
                    type="text"
                    placeholder={t('auth.fullName')}
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                    className="h-9 rounded-lg bg-muted/50 border-border/30 placeholder:text-muted-foreground/60"
                  />
                </div>
                <div className="space-y-1.5">
                  <Input
                    id="signup-email"
                    type="email"
                    placeholder={t('auth.email')}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="h-9 rounded-lg bg-muted/50 border-border/30 placeholder:text-muted-foreground/60"
                  />
                </div>
                <div className="space-y-1.5">
                  <Input
                    id="signup-phone"
                    type="tel"
                    placeholder={t('auth.phone')}
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    required
                    className="h-9 rounded-lg bg-muted/50 border-border/30 placeholder:text-muted-foreground/60"
                  />
                </div>
                <div className="space-y-1.5">
                  <Input
                    id="signup-password"
                    type="password"
                    placeholder={t('auth.password')}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={12}
                    className="h-9 rounded-lg bg-muted/50 border-border/30"
                  />
                   <p className="text-[10px] text-muted-foreground">
                    {t('auth.passwordRequirements')}
                  </p>
                </div>
                <div
                  className="overflow-hidden transition-all duration-300 ease-in-out"
                  style={{
                    maxHeight: showConfirmField ? '80px' : '0px',
                    opacity: showConfirmField ? 1 : 0,
                    transform: showConfirmField ? 'translateY(0)' : 'translateY(-8px)',
                  }}
                >
                  <div className="space-y-1.5">
                    <Input
                      id="signup-confirm-password"
                      type="password"
                      placeholder={t('auth.confirmPassword')}
                      value={signupConfirmPassword}
                      onChange={(e) => setSignupConfirmPassword(e.target.value)}
                      className="h-9 rounded-lg bg-muted/50 border-border/30"
                    />
                    {signupConfirmPassword.length > 0 && !passwordsMatch && (
                      <p className="text-[10px] text-destructive">
                        Passwords do not match
                      </p>
                    )}
                  </div>
                </div>

                <Button type="submit" className="w-full h-9 rounded-lg text-sm font-semibold" disabled={!canCreateAccount}>
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {t('auth.createAccount')}
                </Button>

                <div className="relative my-4">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t border-border/30" />
                  </div>
                  <div className="relative flex justify-center text-xs">
                    <span className="bg-card px-3 text-foreground font-medium">
                      {t('auth.or')}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3">
                  <button
                    type="button"
                    onClick={handleAppleSignIn}
                    className={`${appleButtonClass} inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-lg transition-all active:scale-95`}
                  >
                    <FaApple className={appleIconClass} />
                    {t('auth.continueWithApple')}
                  </button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleGoogleSignIn}
                    className="h-9 rounded-lg bg-[#4285F4] hover:bg-[#3b78e7] dark:bg-[#4285F4] dark:hover:bg-[#3b78e7] border-none text-white dark:text-white text-sm font-semibold shadow-md"
                  >
                    <div className="mr-2 bg-white rounded-full w-6 h-6 flex items-center justify-center">
                      <FcGoogle className="!h-5 !w-5" />
                    </div>
                    {t('auth.continueWithGoogle')}
                  </Button>
                </div>

              </form>
            </TabsContent>
          </Tabs>
        </CardContent>

        <CardFooter className="flex flex-col gap-2">
          <p className="text-xs text-center text-muted-foreground w-full">
            By continuing, you agree to our{' '}
            <button type="button" onClick={() => navigate('/legal/terms')} className="underline hover:text-foreground transition-colors">Terms of Service</button>
            {' '}and{' '}
            <button type="button" onClick={() => navigate('/legal/privacy')} className="underline hover:text-foreground transition-colors">Privacy Policy</button>
          </p>
          <p className="text-xs text-muted-foreground">
            {branding?.tenant_name || 'Sashiko'} © {new Date().getFullYear()} · All rights reserved
          </p>
        </CardFooter>
        </Card>
      </div>
    </div>
  );
};

export default Auth;
