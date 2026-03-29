import { Home, Calendar, User, ShoppingCart, Package, LogOut, Settings } from 'lucide-react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { useCart } from '@/contexts/CartContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useBranding } from '@/hooks/useBranding';
import { formatCurrency } from '@/lib/currency';
import { usePermissions } from '@/hooks/usePermissions';
import sashikoLogo from '@/assets/sashiko-logo.png';

export const Sidebar = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { itemCount, total } = useCart();
  const { branding } = useBranding();
  const { hasStaffRole, userRoles, loading } = usePermissions();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/auth');
  };

  const navItems = [
    { path: '/', label: t('nav.menu'), icon: Home },
    { path: '/order-history', label: t('nav.orders'), icon: Package },
    { path: '/book-table', label: t('home.bookTable'), icon: Calendar },
    { path: '/profile', label: t('nav.profile'), icon: User },
  ];

  return (
    <aside className="hidden lg:flex flex-col w-64 h-screen bg-card border-r border-border sticky top-0">
      <div className="p-6 border-b border-border">
        <div className="flex items-center gap-3">
          <img src={sashikoLogo} alt="Sashiko Asian Fusion" className="h-10 w-10 object-contain rounded-lg" />
          <div>
            <h2 className="text-lg font-bold text-foreground">Sashiko Asian Fusion</h2>
            <p className="text-xs text-muted-foreground">Order & Reserve</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-4 space-y-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200",
                  "hover:bg-primary/10 hover:text-primary",
                  isActive ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground"
                )
              }
            >
              <Icon className="w-5 h-5" />
              <span>{item.label}</span>
            </NavLink>
          );
        })}
        
        {hasStaffRole && !loading && (() => {
          const panelPath = userRoles.includes('admin') || userRoles.includes('manager') || userRoles.includes('branch_manager')
            ? '/admin'
            : userRoles.includes('delivery') ? '/driver' : '/staff';
          const panelLabel = panelPath === '/admin' ? 'Admin Panel' : panelPath === '/driver' ? 'Driver Panel' : 'Staff Panel';
          return (
            <NavLink
              to={panelPath}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200",
                  "hover:bg-primary/10 hover:text-primary border-t mt-2 pt-4",
                  isActive ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground"
                )
              }
            >
              <Settings className="w-5 h-5" />
              <span>{panelLabel}</span>
            </NavLink>
          );
        })()}
      </nav>

      {itemCount > 0 && (
        <div className="p-4 border-t border-border">
          <Button onClick={() => navigate('/cart')} className="w-full justify-between" size="lg">
            <div className="flex items-center gap-2">
              <ShoppingCart className="w-5 h-5" />
              <span>{t('cart.title')}</span>
              <Badge variant="secondary" className="ml-1">{itemCount}</Badge>
            </div>
            <span className="font-bold">{formatCurrency(total)}</span>
          </Button>
        </div>
      )}

      <div className="p-4 border-t border-border">
        <Button onClick={handleSignOut} variant="ghost" className="w-full justify-start gap-3 text-muted-foreground hover:text-destructive">
          <LogOut className="w-5 h-5" />
          <span>{t('profile.logOut')}</span>
        </Button>
      </div>
    </aside>
  );
};
