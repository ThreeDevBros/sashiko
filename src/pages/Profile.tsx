import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { User, Mail, Phone, Lock, Shield, Package, LogOut, Trash2, MapPin, Coins, Calendar, Info, FileText, ShieldCheck, Settings } from 'lucide-react';

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { SettingsSection, SettingsRow, SettingsLink } from '@/components/ui/settings-section';
import { FloatingBranchWidget } from '@/components/FloatingBranchWidget';

import { useAuth } from '@/contexts/AuthContext';
import { useAdmin } from '@/hooks/useAdmin';
import { usePermissions } from '@/hooks/usePermissions';
import { formatCurrency } from '@/lib/currency';
import { useBranding } from '@/hooks/useBranding';
import { BackButton } from '@/components/BackButton';
import LoadingScreen from '@/components/LoadingScreen';
import { SocialMediaSection } from '@/components/SocialMediaSection';

export default function Profile() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user: authUser, isAuthReady } = useAuth();
  const { isAdmin } = useAdmin();
  const { hasStaffRole, userRoles } = usePermissions();
  const { branding } = useBranding();

  const hasDriverRole = userRoles.includes('delivery');
  const hasNonDriverStaffRole = userRoles.includes('staff') || userRoles.includes('manager') || userRoles.includes('branch_manager');
  const showAdminPanel = isAdmin || hasStaffRole;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [cashbackBalance, setCashbackBalance] = useState<number>(0);
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [savedPhone, setSavedPhone] = useState('');
  const [savedName, setSavedName] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const [editNameOpen, setEditNameOpen] = useState(false);
  const [editPhoneOpen, setEditPhoneOpen] = useState(false);
  const [editNameValue, setEditNameValue] = useState('');
  const [editPhoneValue, setEditPhoneValue] = useState('');
  const [addresses, setAddresses] = useState<any[]>([]);

  // Collapsible states
  const [personalOpen, setPersonalOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);

  useEffect(() => {
    if (!isAuthReady) return;
    if (!authUser) { setLoading(false); return; }
    setUser(authUser);
    const loadProfile = async () => {
      const { data: profile } = await supabase.from('profiles').select('*').eq('id', authUser.id).single();
      if (profile) {
        setFullName(profile.full_name || '');
        setSavedName(profile.full_name || '');
        setPhone(profile.phone || '');
        setSavedPhone(profile.phone || '');
        setCashbackBalance((profile as any).cashback_balance || 0);
      }
      setLoading(false);
    };
    loadProfile();
  }, [authUser, isAuthReady]);
  useEffect(() => { if (user?.id) fetchAddresses(); }, [user?.id]);

  const fetchAddresses = async () => {
    try {
      const { data, error } = await supabase.from('user_addresses').select('*').eq('user_id', user.id).order('is_default', { ascending: false });
      if (error) throw error;
      setAddresses(data || []);
    } catch (error: any) { console.error('Fetch addresses error:', error); }
  };

  const handleSaveName = async () => {
    if (!editNameValue.trim() || editNameValue.trim().length < 2) {
      toast({ title: 'Error', description: 'Full name must be at least 2 characters.', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.from('profiles').update({ full_name: editNameValue.trim() }).eq('id', user.id);
      if (error) throw error;
      setFullName(editNameValue.trim());
      setSavedName(editNameValue.trim());
      setEditNameOpen(false);
      toast({ title: 'Name updated' });
    } catch { toast({ title: 'Update failed', variant: 'destructive' }); }
    finally { setSaving(false); }
  };

  const handleSavePhone = async () => {
    if (!editPhoneValue.trim()) {
      setPhoneError('All users must have a saved phone number');
      return;
    }
    if (editPhoneValue.trim().length < 6) {
      setPhoneError('Phone number must be at least 6 digits');
      return;
    }
    setPhoneError('');
    setSaving(true);
    try {
      const { error } = await supabase.from('profiles').update({ phone: editPhoneValue.trim() }).eq('id', user.id);
      if (error) throw error;
      setPhone(editPhoneValue.trim());
      setSavedPhone(editPhoneValue.trim());
      setEditPhoneOpen(false);
      toast({ title: 'Phone updated' });
    } catch { toast({ title: 'Update failed', variant: 'destructive' }); }
    finally { setSaving(false); }
  };

  const handleDeleteAddress = async (addressId: string) => {
    try {
      const { error } = await supabase.from('user_addresses').delete().eq('id', addressId);
      if (error) throw error;
      toast({ title: 'Address deleted', description: 'Your delivery address has been removed.' });
      fetchAddresses();
    } catch (error: any) { toast({ title: 'Error', description: 'Failed to delete address.', variant: 'destructive' }); }
  };

  const handleSetDefaultAddress = async (addressId: string) => {
    try {
      await supabase.from('user_addresses').update({ is_default: false }).eq('user_id', user.id);
      const { error } = await supabase.from('user_addresses').update({ is_default: true }).eq('id', addressId);
      if (error) throw error;
      toast({ title: 'Default address updated' });
      fetchAddresses();
    } catch (error: any) { toast({ title: 'Error', description: 'Failed to set default address.', variant: 'destructive' }); }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) { toast({ title: 'Error', description: 'Passwords do not match', variant: 'destructive' }); return; }
    if (newPassword.length < 6) { toast({ title: 'Error', description: 'Password must be at least 6 characters', variant: 'destructive' }); return; }
    setSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      toast({ title: 'Password updated', description: 'Your password has been changed successfully.' });
      setChangePasswordOpen(false); setNewPassword(''); setConfirmPassword('');
    } catch (error: any) { toast({ title: 'Password update failed', variant: 'destructive' }); } finally { setSaving(false); }
  };

  const handleLogout = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      toast({ title: 'Logged out' });
      navigate('/auth');
    } catch (error: any) { toast({ title: 'Logout failed', variant: 'destructive' }); }
  };

  const handleDeleteAccount = async () => {
    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No active session');
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/delete-account`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
      });
      if (!response.ok) { const error = await response.json(); throw new Error(error.error || 'Failed to delete account'); }
      toast({ title: 'Account deleted' });
      await supabase.auth.signOut();
      navigate('/auth');
    } catch (error: any) { toast({ title: 'Deletion failed', description: error.message, variant: 'destructive' }); } finally { setSaving(false); }
  };

  if (loading) return <LoadingScreen show={true} />;

  const currency = branding?.currency || 'EUR';
  const isGuest = !user;

  return (
    <div className="min-h-screen pb-20">
      <FloatingBranchWidget />
      <main className="container mx-auto px-4 py-8 max-w-2xl">
        <div className="mb-6">
          <BackButton />
        </div>
        <h1 className="text-3xl font-bold mb-6">{isGuest ? t('profile.guestTitle') : t('profile.title')}</h1>

        <div className="space-y-4">
          {/* === Logged-in only sections === */}
          {!isGuest && (
            <>
              {/* Admin Panel Link */}
              {showAdminPanel && (
                <Card className="bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border-primary/20">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-full bg-primary/10">
                          <Shield className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-sm">{t('profile.staffAccess')}</h3>
                          <p className="text-xs text-muted-foreground">{t('profile.staffAccessDesc')}</p>
                        </div>
                      </div>
                      <Button size="sm" onClick={() => {
                        if (isAdmin) navigate('/admin');
                        else if (hasDriverRole && !hasNonDriverStaffRole) navigate('/driver');
                        else if (hasNonDriverStaffRole) navigate('/staff');
                        else navigate('/admin');
                      }}>
                        {t('profile.goToPanel')}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Sashiko Points */}
              <Card className="bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-transparent border-amber-500/20">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 rounded-full bg-amber-500/10">
                        <Coins className="h-6 w-6 text-amber-500" />
                      </div>
                      <div>
                        <h3 className="font-bold text-base">{t('profile.sashikoPoints')}</h3>
                        <p className="text-xs text-muted-foreground">{t('profile.earnPoints')}</p>
                      </div>
                    </div>
                    <p className="text-2xl font-bold text-amber-500">
                      {formatCurrency(cashbackBalance, currency)}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </>
          )}

          {/* Order History */}
          <SettingsLink icon={Package} title={t('profile.orderHistory')} onClick={() => navigate('/order-history')} />

          {/* Reservation History */}
          <SettingsLink icon={Calendar} title={t('profile.reservationHistory')} onClick={() => navigate('/reservation-history')} />

          {/* === Logged-in only sections === */}
          {!isGuest && (
            <>
              {/* Personal Information */}
              <SettingsSection icon={User} title={t('profile.personalInfo')} open={personalOpen} onOpenChange={setPersonalOpen} variant="rows">
                <SettingsRow
                  icon={User}
                  label={t('profile.fullName')}
                  value={fullName}
                  onClick={() => { setEditNameValue(fullName); setEditNameOpen(true); }}
                />
                <SettingsRow
                  icon={Phone}
                  label={t('profile.phone')}
                  value={phone}
                  onClick={() => { setEditPhoneValue(phone); setPhoneError(''); setEditPhoneOpen(true); }}
                  showDivider
                />
                <SettingsRow
                  icon={Mail}
                  label={t('profile.email')}
                  value={user?.email}
                  showDivider
                />
              </SettingsSection>

              {/* Edit Name Dialog */}
              <Dialog open={editNameOpen} onOpenChange={setEditNameOpen}>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{t('profile.editName')}</DialogTitle>
                    <DialogDescription>{t('profile.editNameDesc')}</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="editName">{t('profile.fullName')}</Label>
                      <Input id="editName" value={editNameValue} onChange={(e) => setEditNameValue(e.target.value)} placeholder="Enter your full name" />
                    </div>
                    <Button onClick={handleSaveName} disabled={saving} className="w-full">
                      {saving ? t('profile.saving') : t('profile.save')}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>

              {/* Edit Phone Dialog */}
              <Dialog open={editPhoneOpen} onOpenChange={(open) => { setEditPhoneOpen(open); if (!open) setPhoneError(''); }}>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{t('profile.editPhone')}</DialogTitle>
                    <DialogDescription>{t('profile.editPhoneDesc')}</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="editPhone">{t('profile.phone')}</Label>
                      {phoneError && <p className="text-xs text-destructive">{phoneError}</p>}
                      <Input id="editPhone" type="tel" value={editPhoneValue} onChange={(e) => { setEditPhoneValue(e.target.value); setPhoneError(''); }} placeholder="Enter your phone number" className={phoneError ? 'border-destructive' : ''} />
                    </div>
                    <Button onClick={handleSavePhone} disabled={saving} className="w-full">
                      {saving ? t('profile.saving') : t('profile.save')}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>

              {/* Delivery Addresses */}
              <SettingsLink icon={MapPin} title={t('profile.deliveryAddresses')} onClick={() => navigate('/profile/address')} />

              {/* Account Settings */}
              <SettingsSection icon={Lock} title={t('profile.accountSettings')} open={accountOpen} onOpenChange={setAccountOpen} variant="actions">
                <Dialog open={changePasswordOpen} onOpenChange={setChangePasswordOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" className="w-full justify-start">
                      <Lock className="mr-2 h-4 w-4" /> {t('profile.changePassword')}
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>{t('profile.changePassword')}</DialogTitle>
                      <DialogDescription>{t('profile.changePasswordDesc')}</DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleChangePassword} className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="newPassword">{t('profile.newPassword')}</Label>
                        <Input id="newPassword" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Enter new password" required />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="confirmPassword">{t('profile.confirmPassword')}</Label>
                        <Input id="confirmPassword" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Confirm new password" required />
                      </div>
                      <Button type="submit" disabled={saving} className="w-full">
                        {saving ? t('profile.updating') : t('profile.updatePassword')}
                      </Button>
                    </form>
                  </DialogContent>
                </Dialog>

                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" className="w-full justify-start text-destructive hover:text-destructive">
                      <Trash2 className="mr-2 h-4 w-4" /> {t('profile.deleteAccount')}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>{t('profile.deleteConfirmTitle')}</AlertDialogTitle>
                      <AlertDialogDescription>
                        {t('profile.deleteConfirmDesc')}
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>{t('profile.cancel')}</AlertDialogCancel>
                      <AlertDialogAction onClick={handleDeleteAccount} disabled={saving} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                        {saving ? t('profile.deleting') : t('profile.deleteAccount')}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </SettingsSection>
            </>
          )}

          {/* About Us (visible to everyone) */}
          <SettingsSection icon={Info} title={t('profile.about')} open={aboutOpen} onOpenChange={setAboutOpen} variant="rows">
             <SettingsRow
              icon={ShieldCheck}
              label="Privacy Policy"
              onClick={() => navigate('/legal/privacy')}
            />
             <SettingsRow
               icon={FileText}
               label="Terms & Conditions"
               onClick={() => navigate('/legal/terms')}
               showDivider
             />
           </SettingsSection>

          {/* Settings */}
          <SettingsLink icon={Settings} title={t('profile.settings')} onClick={() => navigate('/settings')} />


          {isGuest ? (
            <button
              onClick={() => navigate('/auth')}
              className="w-full py-6 text-center text-xl font-bold transition-all hover:opacity-80 active:scale-95"
              style={{ color: branding?.primary_color || 'hsl(var(--primary))' }}
            >
              {t('auth.signIn')} →
            </button>
          ) : (
            <button
              onClick={handleLogout}
              className="w-full py-6 text-center text-xl font-bold text-destructive transition-all hover:opacity-80 active:scale-95"
            >
              {t('profile.logOut')} →
            </button>
          )}
        </div>

        <SocialMediaSection page="profile" />

        <div className="text-center mt-8 pb-4">
          <p className="text-xs text-muted-foreground">
            {branding?.tenant_name || 'Sashiko'} © {new Date().getFullYear()}
          </p>
          <p className="text-xs text-muted-foreground mt-1">All rights reserved</p>
        </div>
      </main>
    </div>
  );
}
