import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { UserCircle, Loader2, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type ProviderName = 'google' | 'apple';

interface PrefillSnapshot {
  full_name: string;
  phone: string;
  email: string;
  provider: ProviderName;
}

/**
 * Shown the first time an OAuth (Google / Apple) user signs in if any of the
 * three mandatory fields — full name, phone, email — is missing on their profile.
 *
 * Fields the provider already supplied are pre-filled and locked. Missing fields
 * must be entered before the dialog can be dismissed.
 */
export function CompleteProfileDialog() {
  const { t } = useTranslation();
  const { user, isAuthReady } = useAuth();

  const [open, setOpen] = useState(false);
  const [snapshot, setSnapshot] = useState<PrefillSnapshot | null>(null);
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [errors, setErrors] = useState<{ fullName?: string; phone?: string; email?: string }>({});
  const [saving, setSaving] = useState(false);

  // Fields the provider already supplied — these stay read-only.
  const providerHas = useMemo(() => ({
    fullName: !!snapshot?.full_name,
    phone: !!snapshot?.phone,
    email: !!snapshot?.email,
  }), [snapshot]);

  const checkAndOpen = async (userId: string, provider: ProviderName, meta: any, authEmail: string | null | undefined) => {
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, phone, email')
      .eq('id', userId)
      .maybeSingle();

    const profileFullName = (profile?.full_name || '').trim();
    const profilePhone = (profile?.phone || '').trim();
    const profileEmail = (profile?.email || authEmail || '').trim();

    const missing = !profileFullName || !profilePhone || !profileEmail;
    if (!missing) return;

    // Resolve what the provider gave us (used to lock filled fields).
    const providerName =
      (meta?.full_name as string) ||
      (meta?.name as string) ||
      [meta?.given_name, meta?.family_name].filter(Boolean).join(' ').trim() ||
      '';

    const snap: PrefillSnapshot = {
      full_name: profileFullName || providerName || '',
      phone: profilePhone || '',
      email: profileEmail || '',
      provider,
    };

    setSnapshot(snap);
    setFullName(snap.full_name);
    setPhone(snap.phone);
    setEmail(snap.email);
    setErrors({});
    setOpen(true);
  };

  useEffect(() => {
    if (!isAuthReady || !user) return;
    const provider = user.app_metadata?.provider;
    if (provider !== 'google' && provider !== 'apple') return;

    const timer = setTimeout(() => {
      checkAndOpen(user.id, provider as ProviderName, user.user_metadata, user.email);
    }, 800);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, isAuthReady]);

  // Also catch fresh OAuth redirects.
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event !== 'SIGNED_IN' || !session?.user) return;
      const provider = session.user.app_metadata?.provider;
      if (provider !== 'google' && provider !== 'apple') return;
      setTimeout(() => {
        checkAndOpen(session.user.id, provider as ProviderName, session.user.user_metadata, session.user.email);
      }, 1000);
    });
    return () => subscription.unsubscribe();
  }, []);

  const validate = () => {
    const next: typeof errors = {};
    const trimmedName = fullName.trim();
    const trimmedEmail = email.trim();
    const phoneDigits = phone.replace(/\D/g, '');

    if (trimmedName.length < 2) {
      next.fullName = t('auth.nameTooShort', 'Please enter your full name (at least 2 characters).');
    }
    if (phoneDigits.length < 6) {
      next.phone = t('auth.phoneTooShort', 'Please enter a valid phone number.');
    }
    if (!EMAIL_REGEX.test(trimmedEmail)) {
      next.email = t('auth.emailInvalid', 'Please enter a valid email address.');
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSave = async () => {
    if (!user || !snapshot) return;
    if (!validate()) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .upsert({
          id: user.id,
          full_name: fullName.trim(),
          phone: phone.trim(),
          email: email.trim(),
        }, { onConflict: 'id' });
      if (error) throw error;

      toast.success(t('auth.profileCompleted', 'Profile completed!'));
      setOpen(false);
    } catch {
      toast.error(t('auth.profileSaveFailed', 'Failed to save. Please try again.'));
    } finally {
      setSaving(false);
    }
  };

  const providerLabel = snapshot?.provider === 'apple'
    ? t('auth.fromApple', 'from Apple')
    : t('auth.fromGoogle', 'from Google');

  if (!snapshot) return null;

  return (
    <Dialog open={open} onOpenChange={() => { /* non-dismissible */ }}>
      <DialogContent
        className="sm:max-w-md"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserCircle className="h-5 w-5 text-primary" />
            {t('auth.fillMissingInfo', 'Fill in Missing Information')}
          </DialogTitle>
          <DialogDescription>
            {t(
              'auth.fillMissingInfoDesc',
              'We couldn\'t get all your details from your sign-in. Please confirm the info below and complete what\'s missing to continue.'
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Full name */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="cp-name">
                {t('profile.fullName', 'Full Name')} <span className="text-destructive">*</span>
              </Label>
              {providerHas.fullName && (
                <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3 text-primary" />
                  {providerLabel}
                </span>
              )}
            </div>
            {errors.fullName && <p className="text-xs text-destructive">{errors.fullName}</p>}
            <Input
              id="cp-name"
              value={fullName}
              onChange={(e) => { setFullName(e.target.value); setErrors((p) => ({ ...p, fullName: undefined })); }}
              readOnly={providerHas.fullName}
              className={`${providerHas.fullName ? 'opacity-80' : ''} ${errors.fullName ? 'border-destructive' : ''}`}
              placeholder={t('profile.fullName', 'Full Name')}
              autoFocus={!providerHas.fullName}
            />
          </div>

          {/* Phone */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="cp-phone">
                {t('profile.phone', 'Phone Number')} <span className="text-destructive">*</span>
              </Label>
              {providerHas.phone && (
                <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3 text-primary" />
                  {providerLabel}
                </span>
              )}
            </div>
            {errors.phone && <p className="text-xs text-destructive">{errors.phone}</p>}
            <Input
              id="cp-phone"
              type="tel"
              value={phone}
              onChange={(e) => { setPhone(e.target.value); setErrors((p) => ({ ...p, phone: undefined })); }}
              readOnly={providerHas.phone}
              className={`${providerHas.phone ? 'opacity-80' : ''} ${errors.phone ? 'border-destructive' : ''}`}
              placeholder="+30 123 456 7890"
              autoFocus={!providerHas.fullName ? false : !providerHas.phone}
            />
          </div>

          {/* Email */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="cp-email">
                {t('auth.email', 'Email')} <span className="text-destructive">*</span>
              </Label>
              {providerHas.email && (
                <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3 text-primary" />
                  {providerLabel}
                </span>
              )}
            </div>
            {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
            <Input
              id="cp-email"
              type="email"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setErrors((p) => ({ ...p, email: undefined })); }}
              readOnly={providerHas.email}
              className={`${providerHas.email ? 'opacity-80' : ''} ${errors.email ? 'border-destructive' : ''}`}
              placeholder="you@example.com"
            />
          </div>

          <Button onClick={handleSave} disabled={saving} className="w-full">
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t('auth.continue', 'Continue')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
