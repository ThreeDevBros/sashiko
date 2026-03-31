import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Phone, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

/**
 * Prompts OAuth users (Google/Apple) to enter their phone number
 * if their profile doesn't have one yet.
 */
export function PhonePromptDialog() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);
  const [phoneError, setPhoneError] = useState('');

  useEffect(() => {
    const checkPhoneNeeded = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;

      const provider = session.user.app_metadata?.provider;
      // Only prompt for OAuth users (google, apple)
      if (provider !== 'google' && provider !== 'apple') return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('phone')
        .eq('id', session.user.id)
        .single();

      if (!profile?.phone || profile.phone.trim() === '') {
        setOpen(true);
      }
    };

    // Check on mount
    checkPhoneNeeded();

    // Also check when auth state changes (e.g. after OAuth redirect)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        const provider = session.user.app_metadata?.provider;
        if (provider === 'google' || provider === 'apple') {
          // Small delay to ensure profile trigger has run
          setTimeout(async () => {
            const { data: profile } = await supabase
              .from('profiles')
              .select('phone')
              .eq('id', session.user.id)
              .single();

            if (!profile?.phone || profile.phone.trim() === '') {
              setOpen(true);
            }
          }, 1000);
        }
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSave = async () => {
    const trimmed = phone.trim();
    const digits = trimmed.replace(/\D/g, '');

    if (!trimmed) {
      setPhoneError(t('profile.phoneRequired', 'Phone number is required'));
      return;
    }
    if (digits.length < 6) {
      setPhoneError(t('profile.phoneMinDigits', 'Phone number must be at least 6 digits'));
      return;
    }

    setPhoneError('');
    setSaving(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No user');

      const { error } = await supabase
        .from('profiles')
        .update({ phone: trimmed })
        .eq('id', user.id);

      if (error) throw error;

      toast.success(t('profile.phoneUpdated', 'Phone number saved!'));
      setOpen(false);
    } catch {
      toast.error(t('profile.phoneUpdateFailed', 'Failed to save phone number. Please try again.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => {
      // Don't allow dismissing without entering phone
      if (!v && !phone.trim()) return;
      setOpen(v);
    }}>
      <DialogContent
        className="sm:max-w-md"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Phone className="h-5 w-5 text-primary" />
            {t('auth.addPhone', 'Add Your Phone Number')}
          </DialogTitle>
          <DialogDescription>
            {t('auth.addPhoneDesc', 'Please enter your phone number so we can contact you about your orders.')}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label htmlFor="oauth-phone">{t('profile.phone', 'Phone Number')}</Label>
            {phoneError && <p className="text-xs text-destructive">{phoneError}</p>}
            <Input
              id="oauth-phone"
              type="tel"
              value={phone}
              onChange={(e) => { setPhone(e.target.value); setPhoneError(''); }}
              placeholder="+30 123 456 7890"
              className={phoneError ? 'border-destructive' : ''}
              autoFocus
            />
          </div>
          <Button onClick={handleSave} disabled={saving} className="w-full">
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t('profile.save', 'Save')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
