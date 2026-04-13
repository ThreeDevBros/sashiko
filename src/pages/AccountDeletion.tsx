import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { BackButton } from '@/components/BackButton';
import { Check, X, AlertTriangle, Loader2 } from 'lucide-react';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerFooter,
} from '@/components/ui/drawer';

export default function AccountDeletion() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();

  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [profilePhone, setProfilePhone] = useState<string | null>(null);
  const [profileLoaded, setProfileLoaded] = useState(false);

  const [emailValid, setEmailValid] = useState(false);
  const [phoneValid, setPhoneValid] = useState(false);
  const [passwordValid, setPasswordValid] = useState<boolean | null>(null);
  const [passwordChecking, setPasswordChecking] = useState(false);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Load profile phone
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase.from('profiles').select('phone').eq('id', user.id).single();
      setProfilePhone(data?.phone || null);
      setProfileLoaded(true);
    })();
  }, [user]);

  // Validate email
  useEffect(() => {
    setEmailValid(!!user?.email && email.trim().toLowerCase() === user.email.toLowerCase());
  }, [email, user]);

  // Validate phone
  useEffect(() => {
    if (!profileLoaded) return;
    const trimmed = phone.trim().replace(/\s+/g, '');
    const savedTrimmed = (profilePhone || '').replace(/\s+/g, '');
    setPhoneValid(!!savedTrimmed && trimmed === savedTrimmed);
  }, [phone, profilePhone, profileLoaded]);

  // Validate password with debounce
  useEffect(() => {
    if (!password || password.length < 6 || !user?.email) {
      setPasswordValid(null);
      return;
    }
    setPasswordChecking(true);
    const timer = setTimeout(async () => {
      try {
        const { error } = await supabase.auth.signInWithPassword({
          email: user.email!,
          password,
        });
        setPasswordValid(!error);
      } catch {
        setPasswordValid(false);
      } finally {
        setPasswordChecking(false);
      }
    }, 800);
    return () => clearTimeout(timer);
  }, [password, user?.email]);

  const allValid = emailValid && phoneValid && passwordValid === true;

  const handleDelete = useCallback(async () => {
    setDeleting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No active session');

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/delete-account`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
        }
      );

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to delete account');
      }

      await supabase.auth.signOut();
      toast({ title: 'Account deleted', description: 'Your account and all data have been permanently removed.' });
      navigate('/auth', { replace: true });
    } catch (error: any) {
      toast({ title: 'Deletion failed', description: error.message, variant: 'destructive' });
    } finally {
      setDeleting(false);
      setDrawerOpen(false);
    }
  }, [navigate, toast]);

  if (!user) {
    navigate('/auth', { replace: true });
    return null;
  }

  const ValidationIcon = ({ valid, checking }: { valid: boolean | null; checking?: boolean }) => {
    if (checking) return <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />;
    if (valid === null) return null;
    return valid ? (
      <Check className="h-4 w-4 text-green-500" />
    ) : (
      <X className="h-4 w-4 text-destructive" />
    );
  };

  return (
    <div className="min-h-screen pb-20">
      <main className="container mx-auto px-4 py-8 max-w-md">
        <div className="mb-6">
          <BackButton />
        </div>

        <h1 className="text-2xl font-bold mb-2">Account Deletion</h1>
        <p className="text-sm text-muted-foreground mb-8">
          To proceed with account deletion, please verify your identity by entering your account details below.
        </p>

        <div className="space-y-5">
          {/* Email */}
          <div className="space-y-2">
            <Label htmlFor="del-email">Email Address</Label>
            <div className="relative">
              <Input
                id="del-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your account email"
                className={email && !emailValid ? 'border-destructive' : email && emailValid ? 'border-green-500' : ''}
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <ValidationIcon valid={email ? emailValid : null} />
              </div>
            </div>
          </div>

          {/* Phone */}
          <div className="space-y-2">
            <Label htmlFor="del-phone">Phone Number</Label>
            <div className="relative">
              <Input
                id="del-phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Enter your phone number"
                className={phone && !phoneValid ? 'border-destructive' : phone && phoneValid ? 'border-green-500' : ''}
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <ValidationIcon valid={phone ? phoneValid : null} />
              </div>
            </div>
            {!profilePhone && profileLoaded && (
              <p className="text-xs text-muted-foreground">No phone number on file — please add one in your profile first.</p>
            )}
          </div>

          {/* Password */}
          <div className="space-y-2">
            <Label htmlFor="del-password">Password</Label>
            <div className="relative">
              <Input
                id="del-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                className={
                  passwordValid === false ? 'border-destructive' : passwordValid === true ? 'border-green-500' : ''
                }
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <ValidationIcon valid={passwordValid} checking={passwordChecking} />
              </div>
            </div>
            {passwordValid === false && (
              <p className="text-xs text-destructive">Incorrect password</p>
            )}
          </div>

          {/* Delete Button */}
          <Button
            variant="destructive"
            className="w-full mt-6"
            disabled={!allValid || deleting}
            onClick={() => setDrawerOpen(true)}
          >
            Delete My Account
          </Button>
        </div>

        {/* Warning Drawer */}
        <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
          <DrawerContent>
            <DrawerHeader className="text-center">
              <div className="mx-auto mb-3 p-3 rounded-full bg-destructive/10 w-fit">
                <AlertTriangle className="h-8 w-8 text-destructive" />
              </div>
              <DrawerTitle className="text-xl">Warning: Permanent Deletion</DrawerTitle>
              <DrawerDescription className="text-sm mt-2 leading-relaxed">
                All your personal information, credit points, reward balance, order history, and booking history will be <strong>permanently deleted</strong> and <strong>cannot be recovered</strong>.
              </DrawerDescription>
            </DrawerHeader>
            <DrawerFooter className="gap-3">
              <Button
                variant="destructive"
                className="w-full"
                disabled={deleting}
                onClick={handleDelete}
              >
                {deleting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  'Delete My Account'
                )}
              </Button>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => setDrawerOpen(false)}
                disabled={deleting}
              >
                Go Back
              </Button>
            </DrawerFooter>
          </DrawerContent>
        </Drawer>
      </main>
    </div>
  );
}
