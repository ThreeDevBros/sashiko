import { AdminLayout } from '@/components/admin/AdminLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Upload, Palette, Image, Trash2, RefreshCw, Type, Bold, Italic, Underline } from 'lucide-react';
import { CircularProgress } from '@/components/ui/circular-progress';
import { uploadWithProgress } from '@/lib/uploadWithProgress';
import { Slider } from '@/components/ui/slider';
import { Separator } from '@/components/ui/separator';
import HomePageViewSection from '@/components/admin/HomePageViewSection';
import { ImageUpload } from '@/components/admin/ImageUpload';
import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRateLimitedAction } from '@/hooks/useRateLimitedAction';
import { useUnsavedChangesWarning } from '@/hooks/useUnsavedChangesWarning';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export default function Customise() {
  const queryClient = useQueryClient();
  const [primaryColor, setPrimaryColor] = useState('#16a34a');
  const [accentColor, setAccentColor] = useState('#f97316');
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const loginLogoInputRef = useRef<HTMLInputElement>(null);
  const loginLogoChangeRef = useRef<HTMLInputElement>(null);
  const [restaurantName, setRestaurantName] = useState('');
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [logoProgress, setLogoProgress] = useState(0);
  const [isUploadingLoginLogo, setIsUploadingLoginLogo] = useState(false);
  const [loginLogoProgress, setLoginLogoProgress] = useState(0);
  const [loginBgColor, setLoginBgColor] = useState('#f97316');
  const [loginLogoSize, setLoginLogoSize] = useState(100);
  const [loginTagline, setLoginTagline] = useState('Authentic Asian Cuisine');
  const [loginTaglineBold, setLoginTaglineBold] = useState(false);
  const [loginTaglineItalic, setLoginTaglineItalic] = useState(false);
  const [loginTaglineUnderline, setLoginTaglineUnderline] = useState(false);
  const [loginTaglineColor, setLoginTaglineColor] = useState('#ffffff');
  const [initialized, setInitialized] = useState(false);
  const { executeAction, isOnCooldown } = useRateLimitedAction();

  const { data: branding } = useQuery({
    queryKey: ['tenant-settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tenant_settings')
        .select('*')
        .single();
      
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (branding && !initialized) {
      if (branding.primary_color) setPrimaryColor(branding.primary_color);
      if (branding.accent_color) setAccentColor(branding.accent_color);
      if (branding.login_bg_color) setLoginBgColor(branding.login_bg_color);
      if (branding.login_logo_size) setLoginLogoSize(branding.login_logo_size as number);
      if ((branding as any).login_tagline !== undefined && (branding as any).login_tagline !== null) setLoginTagline((branding as any).login_tagline);
      if ((branding as any).login_tagline_bold !== undefined) setLoginTaglineBold((branding as any).login_tagline_bold);
      if ((branding as any).login_tagline_italic !== undefined) setLoginTaglineItalic((branding as any).login_tagline_italic);
      if ((branding as any).login_tagline_underline !== undefined) setLoginTaglineUnderline((branding as any).login_tagline_underline);
      if ((branding as any).login_tagline_color) setLoginTaglineColor((branding as any).login_tagline_color);
      setInitialized(true);
    }
  }, [branding, initialized]);

  // --- Unsaved changes tracking ---
  const initialValuesRef = useRef<string | null>(null);
  
  const currentSnapshot = useMemo(() => JSON.stringify({
    primaryColor, accentColor, restaurantName,
    loginBgColor, loginLogoSize, loginTagline,
    loginTaglineBold, loginTaglineItalic, loginTaglineUnderline, loginTaglineColor,
  }), [
    primaryColor, accentColor, restaurantName,
    loginBgColor, loginLogoSize, loginTagline,
    loginTaglineBold, loginTaglineItalic, loginTaglineUnderline, loginTaglineColor,
  ]);

  useEffect(() => {
    if (initialized && initialValuesRef.current === null) {
      const timer = setTimeout(() => {
        initialValuesRef.current = currentSnapshot;
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [initialized, currentSnapshot]);

  const isDirty = initialValuesRef.current !== null && currentSnapshot !== initialValuesRef.current;
  const { showDialog, confirmLeave, cancelLeave } = useUnsavedChangesWarning(isDirty);

  const markClean = useCallback(() => {
    initialValuesRef.current = currentSnapshot;
  }, [currentSnapshot]);

  const updateBrandingMutation = useMutation({
    mutationFn: async (updates: any) => {
      if (branding?.id) {
        const { error } = await supabase
          .from('tenant_settings')
          .update(updates)
          .eq('id', branding.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('tenant_settings')
          .insert(updates);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant-settings'] });
      queryClient.invalidateQueries({ queryKey: ['tenant-branding'] });
      markClean();
      toast.success('Branding updated successfully');
    },
    onError: () => {
      toast.error('Failed to update branding');
    },
  });

  const handleLogoUpload = async () => {
    if (!logoFile) return;
    setIsUploadingLogo(true);
    setLogoProgress(0);
    try {
      const fileExt = logoFile.name.split('.').pop();
      const fileName = `logo-${Date.now()}.${fileExt}`;
      
      const { publicUrl } = await uploadWithProgress(
        'restaurant-images', fileName, logoFile,
        (p) => setLogoProgress(p),
      );

      await updateBrandingMutation.mutateAsync({ logo_url: publicUrl });
      setLogoFile(null);
      if (logoInputRef.current) logoInputRef.current.value = '';
    } catch (error) {
      toast.error('Failed to upload logo');
    } finally {
      setIsUploadingLogo(false);
      setLogoProgress(0);
    }
  };

  const handleSaveColors = async () => {
    await executeAction(async () => {
      await updateBrandingMutation.mutateAsync({
        primary_color: primaryColor,
        accent_color: accentColor,
      });
    });
  };


  const handleSaveName = async () => {
    if (!restaurantName.trim()) return;
    await executeAction(async () => {
      await updateBrandingMutation.mutateAsync({
        tenant_name: restaurantName.trim(),
      });
      toast.success('Restaurant name updated');
    });
  };

  return (
    <>
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Customise</h1>
          <p className="text-muted-foreground">Manage your restaurant's branding and appearance</p>
        </div>

        {/* Restaurant Branding — merged card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Palette className="w-5 h-5" />
              Restaurant Branding
            </CardTitle>
            <CardDescription>Logo, name, and color scheme</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Logo */}
            <div className="space-y-3">
              <Label className="text-sm font-semibold">Logo</Label>
              {branding?.logo_url && (
                <div className="rounded-lg border p-4 bg-muted/50 flex items-center justify-between">
                  <img 
                    src={branding.logo_url} 
                    alt="Current logo" 
                    className="h-20 object-contain"
                  />
                  <Button
                    variant="destructive"
                    size="icon"
                    onClick={() => {
                      executeAction(async () => {
                        await updateBrandingMutation.mutateAsync({ logo_url: null });
                      });
                    }}
                    disabled={isOnCooldown}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              )}
              <div>
                <Input
                  ref={logoInputRef}
                  type="file"
                  accept="image/*"
                  onChange={(e) => setLogoFile(e.target.files?.[0] || null)}
                />
              </div>
              <Button 
                onClick={handleLogoUpload}
                disabled={!logoFile || isOnCooldown || isUploadingLogo}
                className="w-full"
              >
                {isUploadingLogo ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Uploading…</>
                ) : (
                  'Upload Logo'
                )}
              </Button>
            </div>

            <Separator />

            {/* Restaurant Name */}
            <div className="space-y-3">
              <Label htmlFor="restaurant-name" className="text-sm font-semibold">Restaurant Name</Label>
              <Input
                id="restaurant-name"
                placeholder={branding?.tenant_name || "Enter restaurant name"}
                value={restaurantName}
                onChange={(e) => setRestaurantName(e.target.value)}
              />
              <Button 
                onClick={handleSaveName}
                disabled={!restaurantName.trim() || isOnCooldown}
                className="w-full"
              >
                Save Name
              </Button>
            </div>

            <Separator />

            {/* Colors */}
            <div className="space-y-3">
              <Label className="text-sm font-semibold">Brand Colors</Label>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="primary-color" className="text-xs text-muted-foreground">Primary Color</Label>
                  <div className="flex gap-3">
                    <Input
                      id="primary-color"
                      type="color"
                      value={primaryColor}
                      onChange={(e) => setPrimaryColor(e.target.value)}
                      className="h-10 w-16"
                    />
                    <Input
                      type="text"
                      value={primaryColor}
                      onChange={(e) => setPrimaryColor(e.target.value)}
                      className="flex-1"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="accent-color" className="text-xs text-muted-foreground">Accent Color</Label>
                  <div className="flex gap-3">
                    <Input
                      id="accent-color"
                      type="color"
                      value={accentColor}
                      onChange={(e) => setAccentColor(e.target.value)}
                      className="h-10 w-16"
                    />
                    <Input
                      type="text"
                      value={accentColor}
                      onChange={(e) => setAccentColor(e.target.value)}
                      className="flex-1"
                    />
                  </div>
                </div>
              </div>
              <Button onClick={handleSaveColors} disabled={isOnCooldown} className="w-full">
                Save Colors
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Login Page Customisation — single merged card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Image className="w-5 h-5" />
              Login Page
            </CardTitle>
            <CardDescription>Customize the background, logo, and tagline of the login page</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Preview */}
            <div className="rounded-lg overflow-hidden border" style={{ background: `linear-gradient(135deg, hsl(var(--background)), ${loginBgColor}, hsl(var(--background)))` }}>
              <div className="flex flex-col items-center justify-center py-8 px-4">
                {branding?.login_logo_url ? (
                  <img 
                    src={branding.login_logo_url} 
                    alt="Login logo preview" 
                    className="object-contain transition-all duration-200"
                    style={{ width: `${loginLogoSize}px`, height: `${loginLogoSize}px` }}
                  />
                ) : (
                  <div className="w-20 h-20 rounded-full bg-foreground/10 flex items-center justify-center">
                    <Image className="w-8 h-8 text-foreground/30" />
                  </div>
                )}
                {loginTagline && (
                  <p
                    className="text-xs mt-2"
                    style={{
                      color: loginTaglineColor,
                      fontWeight: loginTaglineBold ? 'bold' : 'normal',
                      fontStyle: loginTaglineItalic ? 'italic' : 'normal',
                      textDecoration: loginTaglineUnderline ? 'underline' : 'none',
                    }}
                  >
                    {loginTagline}
                  </p>
                )}
                <div className="mt-3 w-full max-w-[140px] space-y-1.5">
                  <div className="h-2 rounded bg-foreground/20 w-full" />
                  <div className="h-2 rounded bg-foreground/20 w-full" />
                  <div className="h-3 rounded bg-primary/60 w-full mt-2" />
                </div>
              </div>
              <div className="text-center pb-2">
                <span className="text-[10px] text-foreground/40">Login page preview</span>
              </div>
            </div>

            <Separator />

            {/* Background Colour */}
            <div className="space-y-2">
              <Label htmlFor="login-bg-color" className="text-sm font-semibold">Background Colour</Label>
              <div className="flex gap-3">
                <Input
                  id="login-bg-color"
                  type="color"
                  value={loginBgColor}
                  onChange={(e) => setLoginBgColor(e.target.value)}
                  className="h-10 w-16"
                />
                <Input
                  type="text"
                  value={loginBgColor}
                  onChange={(e) => setLoginBgColor(e.target.value)}
                  className="flex-1"
                />
              </div>
            </div>

            <Separator />

            {/* Logo */}
            <div className="space-y-3">
              <Label className="text-sm font-semibold">Logo</Label>
              {branding?.login_logo_url ? (
                <>
                  <div className="relative w-full h-16 border rounded-lg overflow-hidden group bg-muted/50">
                    <img 
                      src={branding.login_logo_url} 
                      alt="Login logo" 
                      className="w-full h-full object-contain p-1"
                    />
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                      {isUploadingLoginLogo ? (
                        <CircularProgress progress={loginLogoProgress} size={40} strokeWidth={4} className="text-white" />
                      ) : (
                        <>
                          <Label htmlFor="login-logo-change" className="cursor-pointer">
                            <Button type="button" variant="secondary" size="sm" className="pointer-events-none">
                              <RefreshCw className="w-3 h-3 mr-1" />
                              Change
                            </Button>
                          </Label>
                          <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            onClick={() => {
                              executeAction(async () => {
                                await updateBrandingMutation.mutateAsync({ login_logo_url: null });
                              });
                            }}
                            disabled={isOnCooldown}
                          >
                            <Trash2 className="w-3 h-3 mr-1" />
                            Remove
                          </Button>
                        </>
                      )}
                    </div>
                    <Input
                      ref={loginLogoChangeRef}
                      id="login-logo-change"
                      type="file"
                      accept="image/*"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        setIsUploadingLoginLogo(true);
                        try {
                          const fileName = `login/${crypto.randomUUID()}.${file.type.split('/')[1]}`;
                          const { error } = await supabase.storage.from('restaurant-images').upload(fileName, file);
                          if (error) { toast.error('Upload failed'); return; }
                          const { data: { publicUrl } } = supabase.storage.from('restaurant-images').getPublicUrl(fileName);
                          await updateBrandingMutation.mutateAsync({ login_logo_url: publicUrl });
                        } catch {
                          toast.error('Upload failed');
                        } finally {
                          setIsUploadingLoginLogo(false);
                          if (loginLogoChangeRef.current) loginLogoChangeRef.current.value = '';
                        }
                      }}
                      disabled={updateBrandingMutation.isPending}
                      className="hidden"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Logo Size</Label>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground w-6">S</span>
                      <Slider
                        value={[loginLogoSize]}
                        onValueChange={([v]) => setLoginLogoSize(v)}
                        min={30}
                        max={300}
                        step={5}
                        className="flex-1"
                      />
                      <span className="text-xs text-muted-foreground w-6">L</span>
                      <span className="text-xs text-muted-foreground w-10 text-right">{loginLogoSize}px</span>
                    </div>
                  </div>
                </>
              ) : (
                <div>
                  <Label htmlFor="login-logo-upload" className="cursor-pointer">
                    <div className="flex items-center justify-center gap-2 border-2 border-dashed rounded-lg p-4 hover:bg-muted/50 transition-colors">
                      {isUploadingLoginLogo ? (
                        <><Loader2 className="w-5 h-5 animate-spin" /><span>Uploading…</span></>
                      ) : (
                        <><Upload className="w-5 h-5" /><span>Click to upload login logo</span></>
                      )}
                    </div>
                  </Label>
                  <Input
                    ref={loginLogoInputRef}
                    id="login-logo-upload"
                    type="file"
                    accept="image/*"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      setIsUploadingLoginLogo(true);
                      try {
                        const fileName = `login/${crypto.randomUUID()}.${file.type.split('/')[1]}`;
                        const { error } = await supabase.storage.from('restaurant-images').upload(fileName, file);
                        if (error) { toast.error('Upload failed'); return; }
                        const { data: { publicUrl } } = supabase.storage.from('restaurant-images').getPublicUrl(fileName);
                        await updateBrandingMutation.mutateAsync({ login_logo_url: publicUrl });
                      } catch {
                        toast.error('Upload failed');
                      } finally {
                        setIsUploadingLoginLogo(false);
                        if (loginLogoInputRef.current) loginLogoInputRef.current.value = '';
                      }
                    }}
                    className="hidden"
                  />
                </div>
              )}
            </div>

            <Separator />

            {/* Tagline */}
            <div className="space-y-3">
              <Label htmlFor="login-tagline" className="text-sm font-semibold">Tagline</Label>
              <Input
                id="login-tagline"
                placeholder="e.g. Authentic Asian Cuisine"
                value={loginTagline}
                onChange={(e) => setLoginTagline(e.target.value)}
              />
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Text Style</Label>
                  <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant={loginTaglineBold ? "default" : "outline"}
                    size="sm"
                    onClick={() => setLoginTaglineBold(!loginTaglineBold)}
                    className="w-9 h-9"
                  >
                    <Bold className="w-4 h-4" />
                  </Button>
                  <Button
                    type="button"
                    variant={loginTaglineItalic ? "default" : "outline"}
                    size="sm"
                    onClick={() => setLoginTaglineItalic(!loginTaglineItalic)}
                    className="w-9 h-9"
                  >
                    <Italic className="w-4 h-4" />
                  </Button>
                  <Button
                    type="button"
                    variant={loginTaglineUnderline ? "default" : "outline"}
                    size="sm"
                    onClick={() => setLoginTaglineUnderline(!loginTaglineUnderline)}
                    className="w-9 h-9"
                  >
                    <Underline className="w-4 h-4" />
                  </Button>
                  <div className="ml-auto flex items-center gap-2">
                    <Input
                      type="color"
                      value={loginTaglineColor}
                      onChange={(e) => setLoginTaglineColor(e.target.value)}
                      className="h-9 w-9 p-0.5 cursor-pointer"
                    />
                    <Input
                      type="text"
                      value={loginTaglineColor}
                      onChange={(e) => setLoginTaglineColor(e.target.value)}
                      className="w-24 h-9"
                    />
                  </div>
                </div>
              </div>
            </div>

            <Separator />

            {/* Single Save Button */}
            <Button
              className="w-full"
              disabled={isOnCooldown}
              onClick={() => {
                executeAction(async () => {
                  await updateBrandingMutation.mutateAsync({
                    login_bg_color: loginBgColor,
                    login_logo_size: loginLogoSize,
                    login_tagline: loginTagline,
                    login_tagline_bold: loginTaglineBold,
                    login_tagline_italic: loginTaglineItalic,
                    login_tagline_underline: loginTaglineUnderline,
                    login_tagline_color: loginTaglineColor,
                  } as any);
                });
              }}
            >
              Save Login Page Settings
            </Button>
          </CardContent>
        </Card>

        {/* Home Page View Section */}
        <HomePageViewSection />
      </div>
    </AdminLayout>

    <Dialog open={showDialog} onOpenChange={(open) => { if (!open) cancelLeave(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Leave without saving?</DialogTitle>
          <DialogDescription>
            You have unsaved changes. If you leave now, your changes will be lost.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex gap-2 sm:gap-0">
          <Button variant="ghost" onClick={confirmLeave}>
            Discard Changes
          </Button>
          <Button onClick={cancelLeave} className="bg-primary text-primary-foreground hover:bg-primary/90">
            Keep Editing
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}
