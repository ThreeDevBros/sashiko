import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { useBranding } from '@/hooks/useBranding';
import { Home, UtensilsCrossed, Package, User } from 'lucide-react';

export const TopNav = () => {
  const location = useLocation();
  const { branding } = useBranding();
  const { t } = useTranslation();

  const navItems = [
    { path: '/', label: t('nav.home'), icon: Home },
    { path: '/order', label: t('nav.menu'), icon: UtensilsCrossed },
    { path: '/order-history', label: t('nav.orders'), icon: Package },
    { path: '/profile', label: t('nav.profile'), icon: User },
  ];

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  return (
    <nav className="hidden md:block sticky top-0 z-50 bg-card/95 backdrop-blur-sm border-b border-border/60" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
      <div className="max-w-7xl mx-auto px-6 lg:px-8 h-14 flex items-center justify-between">
        <div className="flex items-center flex-shrink-0">
          {branding?.logo_url ? (
            <img src={branding.logo_url} alt={branding.tenant_name} className="h-7 w-auto object-contain" />
          ) : null}
        </div>
        <div className="flex items-center gap-10 ml-10">
          {navItems.map(({ path, label, icon: Icon }) => (
            <Link
              key={path}
              to={path}
              className={cn(
                'relative flex items-center gap-2 py-1 transition-colors duration-150 group text-sm font-medium',
                isActive(path) ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Icon className={cn('w-[18px] h-[18px] flex-shrink-0 transition-colors', isActive(path) ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground')} />
              <span className="leading-none">{label}</span>
              {isActive(path) && <span className="absolute -bottom-[1px] left-0 w-full h-[2px] rounded-full bg-primary" />}
            </Link>
          ))}
        </div>
        <div className="flex-shrink-0" />
      </div>
    </nav>
  );
};
