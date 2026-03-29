import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { BackButton } from '@/components/BackButton';
import { SettingsSection, SettingsRow } from '@/components/ui/settings-section';
import { FloatingBranchWidget } from '@/components/FloatingBranchWidget';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { useTheme, type Theme } from '@/components/ThemeProvider';
import { useBranding } from '@/hooks/useBranding';
import { Palette, Globe, Bell, Volume2 } from 'lucide-react';

import flagGb from '@/assets/flags/gb.png';
import flagSa from '@/assets/flags/sa.png';
import flagFr from '@/assets/flags/fr.png';
import flagEs from '@/assets/flags/es.png';
import flagDe from '@/assets/flags/de.png';
import flagGr from '@/assets/flags/gr.png';
import flagRu from '@/assets/flags/ru.png';
import flagIl from '@/assets/flags/il.png';
import flagUa from '@/assets/flags/ua.png';

const LANGUAGE_OPTIONS = [
  { value: 'en', label: 'English', flag: flagGb },
  { value: 'el', label: 'Ελληνικά', flag: flagGr },
];

const FlagImg = ({ src, alt }: { src: string; alt: string }) => (
  <img src={src} alt={alt} className="w-7 h-5 rounded-[3px] inline-block object-cover" />
);

export default function Settings() {
  const { t, i18n } = useTranslation();
  const { theme, setTheme } = useTheme();
  const { branding } = useBranding();

  const [language, setLanguage] = useState(() => {
    return localStorage.getItem('app-language') || branding?.language || 'en';
  });

  const [pushEnabled, setPushEnabled] = useState(() => {
    return localStorage.getItem('push-notifications') !== 'disabled';
  });

  const [soundEnabled, setSoundEnabled] = useState(() => {
    return localStorage.getItem('notification-sound') !== 'disabled';
  });

  const [themeOpen, setThemeOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [generalOpen, setGeneralOpen] = useState(false);

  // Language change confirmation
  const [pendingLanguage, setPendingLanguage] = useState<string | null>(null);
  const [langDialogOpen, setLangDialogOpen] = useState(false);

  const handleThemeChange = (newTheme: string) => {
    setTheme(newTheme as Theme);
  };

  const handleLanguageSelect = (lang: string) => {
    if (lang === language) return;
    setPendingLanguage(lang);
    setLangDialogOpen(true);
  };

  const confirmLanguageChange = () => {
    if (!pendingLanguage) return;
    localStorage.setItem('app-language', pendingLanguage);
    i18n.changeLanguage(pendingLanguage);
    setLanguage(pendingLanguage);
    setLangDialogOpen(false);
    setPendingLanguage(null);
    // Reload to reinitialize the app with the new language
    window.location.href = '/';
  };

  const cancelLanguageChange = () => {
    setLangDialogOpen(false);
    setPendingLanguage(null);
  };

  const handlePushToggle = (enabled: boolean) => {
    setPushEnabled(enabled);
    localStorage.setItem('push-notifications', enabled ? 'enabled' : 'disabled');
  };

  const handleSoundToggle = (enabled: boolean) => {
    setSoundEnabled(enabled);
    localStorage.setItem('notification-sound', enabled ? 'enabled' : 'disabled');
  };

  const selectedLang = LANGUAGE_OPTIONS.find(o => o.value === language);

  return (
    <div className="min-h-screen pb-20">
      <FloatingBranchWidget />
      <main className="container mx-auto px-4 py-8 max-w-2xl">
        <div className="mb-6">
          <BackButton />
        </div>
        <h1 className="text-3xl font-bold mb-6">{t('settings.title')}</h1>

        <div className="space-y-4">
          {/* Appearance */}
          <SettingsSection icon={Palette} title={t('settings.appearance')} open={themeOpen} onOpenChange={setThemeOpen} variant="rows">
            <SettingsRow icon={Palette} label={t('settings.theme')}>
              <Select value={theme} onValueChange={handleThemeChange}>
                <SelectTrigger className="w-36 h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="system">{t('settings.systemDefault')}</SelectItem>
                  <SelectItem value="light">{t('settings.light')}</SelectItem>
                  <SelectItem value="dark-grey">{t('settings.dark')}</SelectItem>
                  <SelectItem value="dark">{t('settings.trueBlack')}</SelectItem>
                </SelectContent>
              </Select>
            </SettingsRow>
          </SettingsSection>

          {/* Notifications */}
          <SettingsSection icon={Bell} title={t('settings.notifications')} open={notifOpen} onOpenChange={setNotifOpen} variant="rows">
            <SettingsRow icon={Bell} label={t('settings.pushNotifications')}>
              <Switch checked={pushEnabled} onCheckedChange={handlePushToggle} />
            </SettingsRow>
            <SettingsRow icon={Volume2} label={t('settings.notificationSounds')} showDivider>
              <Switch checked={soundEnabled} onCheckedChange={handleSoundToggle} />
            </SettingsRow>
          </SettingsSection>

          {/* General */}
          <SettingsSection icon={Globe} title={t('settings.general')} open={generalOpen} onOpenChange={setGeneralOpen} variant="rows">
            <SettingsRow icon={Globe} label={t('settings.language')}>
              <Select value={language} onValueChange={handleLanguageSelect}>
                <SelectTrigger className="w-44 h-9">
                  <SelectValue>
                    {selectedLang && (
                      <span className="flex items-center gap-2">
                        <FlagImg src={selectedLang.flag} alt={selectedLang.label} />
                        {selectedLang.label}
                      </span>
                    )}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {LANGUAGE_OPTIONS.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>
                      <span className="flex items-center gap-2">
                        <FlagImg src={opt.flag} alt={opt.label} />
                        {opt.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </SettingsRow>
          </SettingsSection>
        </div>
      </main>

      {/* Language Change Confirmation */}
      <AlertDialog open={langDialogOpen} onOpenChange={setLangDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('settings.changeLanguageTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('settings.changeLanguageDesc')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button variant="outline" onClick={cancelLanguageChange}>
              {t('settings.cancel')}
            </Button>
            <Button onClick={confirmLanguageChange} className="bg-amber-500 hover:bg-amber-600 text-black">
              {t('settings.continue')}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
